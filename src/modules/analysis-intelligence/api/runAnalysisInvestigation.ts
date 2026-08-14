import { getStructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import { buildDatasetSchemaDescription } from '@/modules/data-intelligence/api/buildDatasetSchemaDescription'
import { executeAnalyticalPlan } from '@/modules/data-intelligence/executeAnalyticalPlan'
import { hasFeature } from '@/modules/plans/api/plans'
import { ANALYSIS_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/analysisIntelligence'
import { buildStepPlannerSystemPrompt } from '@/modules/analysis-intelligence/api/buildStepPlannerSystemPrompt'
import { parseAnalysisStepResponse } from '@/modules/analysis-intelligence/api/parseAnalysisStepResponse'
import { formatInvestigationForSynthesis } from '@/modules/analysis-intelligence/api/formatInvestigationForSynthesis'
import { extractObservations } from '@/modules/analysis-intelligence/extractObservations'
import { detectOppositeDirectionTensions } from '@/modules/analysis-intelligence/detectContradictions'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { getChatProvider } from '@/modules/ai/providers/registry'
import type { AnalysisInvestigation, AnalysisStep, Hypothesis } from '@/modules/analysis-intelligence/analysisInvestigation'

/**
 * Analysis Intelligence — the hard, deterministic, application-enforced
 * investigation-step ceiling (architecture audit §14/§16, and the
 * explicit "mandatory" requirement in this phase's brief). Not a
 * quota-table value: Student/Pro/Enterprise are explicitly out of scope
 * this phase, so there is exactly one tier-agnostic budget today,
 * expressed as a plain exported constant rather than a second quota
 * system — a future tier-specific budget is a parameter change at the
 * call site, not a redesign (see runAnalysisInvestigation's `maxSteps`
 * parameter below). Independent of any frontend state: enforced here,
 * in the loop itself, not by the UI choosing when to stop asking.
 */
export const MAX_INVESTIGATION_STEPS = 5

export interface AnalysisInvestigationOutcome {
  investigation: AnalysisInvestigation
}

function investigatedDimensionColumns(steps: AnalysisStep[]): string[] {
  const columns = new Set<string>()
  for (const step of steps) {
    for (const dim of step.plan.dimensions ?? []) columns.add(dim.column)
  }
  return Array.from(columns)
}

function allObservationStatements(steps: AnalysisStep[]): string[] {
  return steps.flatMap((step) => step.observations.map((o) => `[Step ${step.index + 1}: ${step.purpose}] ${o.statement}`))
}

/**
 * Analysis Intelligence — the multi-step orchestration function
 * implementing "question → investigation → bounded sequence of
 * AnalyticalPlan/AnalyticalResult pairs → observations → evidence-
 * grounded synthesis." Mirrors runDataIntelligenceQuery.ts's structure
 * (entitlement check → dataset fetch → AI planning via direct
 * streamChatCompletion → deterministic execution → interpretation via
 * runCapability) but loops the plan/execute/observe portion up to
 * MAX_INVESTIGATION_STEPS times, threading each step's observations
 * into the next step's prompt — the same "sequential chain, each step's
 * output feeds the next" pattern already proven by
 * runKnowledgeExtractionFromContent.
 *
 * executeAnalyticalPlan (Data Intelligence, unmodified, called once per
 * step) remains the only code that ever reads dataset rows or produces
 * a number. The LLM only ever proposes a plan, decides whether to stop,
 * or writes the final synthesis prose — never touches the numbers.
 *
 * `onStepComplete`, when provided, is invoked synchronously with a
 * fresh (immutable) snapshot of the investigation after each step
 * actually completes — the UI's only source of "investigation
 * progress," never a simulated timer.
 */
export async function runAnalysisInvestigation(params: {
  datasetId: string
  question: string
  userId: string
  workspaceId: string | null
  chain: string[]
  maxSteps?: number
  onStepComplete?: (investigation: AnalysisInvestigation) => void
}): Promise<AnalysisInvestigationOutcome> {
  const { datasetId, question, userId, workspaceId, chain, maxSteps = MAX_INVESTIGATION_STEPS, onStepComplete } = params

  if (!(await hasFeature(userId, ANALYSIS_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Analysis Investigation requires an upgraded plan.')
  }

  const dataset = await getStructuredDataset(datasetId)
  // RLS already scopes getStructuredDataset to the caller's own rows; this
  // check is defense-in-depth, not the actual boundary — see
  // structured_datasets_security_test.sql for the real enforcement test.
  if (!dataset || dataset.userId !== userId) throw new Error('Dataset not found.')

  const schemaDescription = buildDatasetSchemaDescription(dataset.sheetName, dataset.columns)

  let investigation: AnalysisInvestigation = {
    id: crypto.randomUUID(),
    question,
    datasetId,
    steps: [],
    hypotheses: [],
    contradictions: [],
    synthesis: null,
    status: 'in_progress',
    stepLimitReached: false,
    declineReason: null,
  }

  let stoppedNaturally = false
  let hadFatalFailure = false

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const priorStep = investigation.steps.at(-1) ?? null

    const stepSystemPrompt = buildStepPlannerSystemPrompt({
      schemaDescription,
      question,
      stepIndex: stepIndex + 1,
      maxSteps,
      priorObservations: allObservationStatements(investigation.steps),
      investigatedDimensions: investigatedDimensionColumns(investigation.steps),
    })

    const { result: stepCall } = await runWithFallback(chain, (candidateId) =>
      streamChatCompletion({
        provider: getChatProvider(candidateId),
        messages: [{ role: 'user', content: question }],
        system: stepSystemPrompt,
        userId,
        workspaceId,
        feature: 'analysis-investigation-step',
        requestedProvider: chain[0],
      }),
    )

    const parsed = parseAnalysisStepResponse(stepCall.content, datasetId)

    if (parsed.status === 'stop') {
      stoppedNaturally = true
      break
    }

    if (parsed.status === 'declined') {
      if (stepIndex === 0) {
        investigation = { ...investigation, status: 'declined', declineReason: parsed.reason }
        return { investigation }
      }
      stoppedNaturally = true
      break
    }

    if (parsed.status === 'invalid') {
      if (stepIndex === 0) {
        investigation = { ...investigation, status: 'failed', declineReason: parsed.reason }
        return { investigation }
      }
      hadFatalFailure = true
      break
    }

    const result = executeAnalyticalPlan(dataset, parsed.plan)
    const stepId = crypto.randomUUID()
    const newStep: AnalysisStep = {
      id: stepId,
      index: stepIndex,
      purpose: parsed.purpose,
      triggeredBy: priorStep?.id ?? null,
      plan: parsed.plan,
      result,
      observations: extractObservations({ id: stepId, result }),
    }

    const newHypotheses: Hypothesis[] =
      parsed.hypothesis
        ? [{ id: crypto.randomUUID(), statement: parsed.hypothesis, supportingObservationIds: newStep.observations.map((o) => o.id), status: 'untested' }]
        : []

    investigation = {
      ...investigation,
      steps: [...investigation.steps, newStep],
      hypotheses: [...investigation.hypotheses, ...newHypotheses],
    }
    onStepComplete?.(investigation)

    if (result.status === 'error') {
      hadFatalFailure = true
      break
    }
  }

  const stepLimitReached = !stoppedNaturally && !hadFatalFailure && investigation.steps.length === maxSteps

  if (investigation.steps.length === 0) {
    investigation = { ...investigation, status: 'failed', declineReason: 'No investigation step could be established.' }
    return { investigation }
  }

  investigation = {
    ...investigation,
    stepLimitReached,
    contradictions: detectOppositeDirectionTensions(investigation.steps),
  }

  const investigationSummary = formatInvestigationForSynthesis(investigation)

  const { result: synthesisCall } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'analysis-investigation-synthesis',
      variables: { investigationSummary },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  investigation = { ...investigation, synthesis: synthesisCall.content.trim(), status: 'complete' }
  onStepComplete?.(investigation)

  return { investigation }
}
