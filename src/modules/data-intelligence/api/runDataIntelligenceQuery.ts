import { getStructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import { hasFeature } from '@/modules/plans/api/plans'
import { DATA_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/dataIntelligence'
import { buildDatasetSchemaDescription } from '@/modules/data-intelligence/api/buildDatasetSchemaDescription'
import { buildPlannerSystemPrompt } from '@/modules/data-intelligence/api/buildPlannerSystemPrompt'
import { parseAnalyticalPlanResponse } from '@/modules/data-intelligence/api/parseAnalyticalPlanResponse'
import { executeAnalyticalPlan } from '@/modules/data-intelligence/executeAnalyticalPlan'
import { formatAnalyticalResultForInterpretation } from '@/modules/data-intelligence/api/formatAnalyticalResultForInterpretation'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { getChatProvider } from '@/modules/ai/providers/registry'
import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

export interface DataIntelligenceQueryOutcome {
  status: 'answered' | 'declined' | 'invalid_plan'
  question: string
  /** Populated only when status:'answered'. */
  answer: string | null
  /** Populated only when status:'declined' or 'invalid_plan' — why no answer was produced. */
  reason: string | null
  /** The deterministic engine's structured output, populated only when status:'answered'. */
  result: AnalyticalResult | null
}

/**
 * Data Intelligence Foundation — the orchestration function implementing
 * "question → analytical plan → deterministic execution → validation/
 * provenance → interpretation" end to end, mirroring
 * generateWorkspaceBriefing.ts's structure (fetch context → run capability
 * via runWithFallback → return). Two AI calls happen here, not one: the
 * planning call is a direct streamChatCompletion invocation with a
 * code-composed prompt (never a registered capability — see
 * buildPlannerSystemPrompt.ts's doc comment), and the interpretation call
 * is the one registered capability (data-intelligence-query, module.ts).
 * The engine in between (executeAnalyticalPlan) is the only code that
 * ever reads dataset rows or produces a number — the LLM only ever
 * proposes a plan or writes prose about an already-computed result.
 *
 * Entitlement is checked explicitly here before the planning call (which
 * doesn't go through runCapability's own check, since it isn't a
 * registered capability) and is re-checked, redundantly but harmlessly,
 * by runCapability before the interpretation call — one fact, checked at
 * both AI call sites, exactly the discipline P0 established.
 */
export async function runDataIntelligenceQuery(params: {
  datasetId: string
  question: string
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<DataIntelligenceQueryOutcome> {
  const { datasetId, question, userId, workspaceId, chain } = params

  if (!(await hasFeature(userId, DATA_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Data Intelligence Query requires an upgraded plan.')
  }

  const dataset = await getStructuredDataset(datasetId)
  // RLS already scopes getStructuredDataset to the caller's own rows; this
  // check is defense-in-depth, not the actual boundary — see
  // structured_datasets_security_test.sql for the real enforcement test.
  if (!dataset || dataset.userId !== userId) throw new Error('Dataset not found.')

  const schemaDescription = buildDatasetSchemaDescription(dataset.sheetName, dataset.columns)
  const plannerSystem = buildPlannerSystemPrompt(schemaDescription)

  const { result: planCall } = await runWithFallback(chain, (candidateId) =>
    streamChatCompletion({
      provider: getChatProvider(candidateId),
      messages: [{ role: 'user', content: question }],
      system: plannerSystem,
      userId,
      workspaceId,
      feature: 'data-intelligence-plan',
      requestedProvider: chain[0],
    }),
  )

  const parsed = parseAnalyticalPlanResponse(planCall.content, datasetId)
  if (parsed.status !== 'ok') {
    return {
      status: parsed.status === 'declined' ? 'declined' : 'invalid_plan',
      question,
      answer: null,
      reason: parsed.reason,
      result: null,
    }
  }

  const result = executeAnalyticalPlan(dataset, parsed.plan)
  const resultSummary = formatAnalyticalResultForInterpretation(result)

  const { result: interpretation } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'data-intelligence-query',
      variables: { question, resultSummary },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  return {
    status: 'answered',
    question,
    answer: interpretation.content.trim(),
    reason: null,
    result,
  }
}
