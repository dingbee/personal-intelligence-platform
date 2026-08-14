import { hasFeature } from '@/modules/plans/api/plans'
import { RESEARCH_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/researchIntelligence'
import { listStructuredDatasetsForDocument } from '@/modules/data-intelligence/api/structuredDatasets'
import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'
import { buildResearchStepPlannerSystemPrompt } from '@/modules/research-intelligence/api/buildResearchStepPlannerSystemPrompt'
import { parseResearchStepResponse } from '@/modules/research-intelligence/api/parseResearchStepResponse'
import { buildEvidenceInterpreterSystemPrompt } from '@/modules/research-intelligence/api/buildEvidenceInterpreterSystemPrompt'
import { parseResearchObservationsResponse } from '@/modules/research-intelligence/api/parseResearchObservationsResponse'
import { formatResearchForSynthesis, collectDistinctSources } from '@/modules/research-intelligence/api/formatResearchForSynthesis'
import { parseResearchSynthesisResponse } from '@/modules/research-intelligence/api/parseResearchSynthesisResponse'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { getChatProvider } from '@/modules/ai/providers/registry'
import type { ResearchInvestigation, ResearchStep, ResearchHypothesis, ResearchEvidence } from '@/modules/research-intelligence/researchInvestigation'

/**
 * Research Intelligence — the hard, deterministic, application-enforced
 * research-step ceiling, following Analysis Intelligence's own
 * MAX_INVESTIGATION_STEPS precedent exactly (see that constant's doc
 * comment in analysis-intelligence/api/runAnalysisInvestigation.ts) —
 * not a quota-table value, since Student/Enterprise tiering is out of
 * scope this phase; a future tier-specific budget is a parameter change
 * at the call site (`maxSteps`), not a redesign.
 *
 * The real worst-case AI-call bound is multiplicative, not just
 * MAX_RESEARCH_STEPS: each evidence_gathering step can cost up to 2
 * calls (planner + evidence interpreter), and at most ONE step per
 * investigation may delegate to Analysis Intelligence
 * (`datasetUsed` below), which is itself bounded by its own
 * MAX_INVESTIGATION_STEPS + 1 calls. With the defaults below (4 research
 * steps, Analysis Intelligence's default 5), the worst case is
 * 4*2 + (5+1) + 1 (final synthesis) = 15 AI calls for one research
 * investigation — a real, documented, enforced ceiling, not an
 * unbounded loop. Whether that ceiling should instead be a metered
 * commercial quota is a product decision explicitly deferred to
 * BACKLOG (P2 brief, Cost Control section) — this constant is the
 * engineering safety boundary regardless of that decision.
 */
export const MAX_RESEARCH_STEPS = 4

export interface ResearchInvestigationOutcome {
  investigation: ResearchInvestigation
}

function priorStepsSummary(steps: ResearchStep[]) {
  return steps.map((s) => ({ purpose: s.purpose, query: s.query, evidenceCount: s.evidence.length, observations: s.observations.map((o) => o.statement) }))
}

/**
 * Research Intelligence — the multi-step orchestration function
 * implementing "question -> Research Investigation -> Investigation
 * Step -> evidence-grounded Synthesis" (P2 brief). Each step is either
 * (a) evidence_gathering: the planner proposes a search query,
 * gatherEvidence.ts executes it deterministically against the caller's
 * own documents/notes, and (if anything was found) a second AI call
 * turns the retrieved evidence into cited observations — or (b)
 * dataset_investigation: the planner proposes a sub-question and this
 * function delegates, unmodified, to Analysis Intelligence's own
 * runAnalysisInvestigation (which in turn reuses Data Intelligence's
 * executeAnalyticalPlan) — the LLM never computes a number itself at
 * any point in this chain. `onStepComplete`, when provided, is invoked
 * synchronously with a fresh (immutable) snapshot after each step
 * actually completes — the UI's only source of "investigation
 * progress," never a simulated timer.
 */
export async function runResearchInvestigation(params: {
  question: string
  scope?: string | null
  context?: string | null
  userId: string
  workspaceId: string | null
  documentId?: string | null
  chain: string[]
  maxSteps?: number
  onStepComplete?: (investigation: ResearchInvestigation) => void
}): Promise<ResearchInvestigationOutcome> {
  const { question, scope = null, context = null, userId, workspaceId, documentId = null, chain, maxSteps = MAX_RESEARCH_STEPS, onStepComplete } = params

  if (!(await hasFeature(userId, RESEARCH_INTELLIGENCE_FEATURE_KEY))) {
    throw new Error('Research Investigation requires an upgraded plan.')
  }

  let datasetId: string | null = null
  if (documentId) {
    const datasets = await listStructuredDatasetsForDocument(documentId)
    datasetId = datasets[0]?.id ?? null
  }
  let datasetUsed = false

  let investigation: ResearchInvestigation = {
    id: crypto.randomUUID(),
    question,
    scope,
    context,
    workspaceId,
    documentId,
    steps: [],
    hypotheses: [],
    comparisons: [],
    gaps: [],
    keyFindings: [],
    synthesis: null,
    limitations: null,
    followUpQuestions: [],
    status: 'in_progress',
    stepLimitReached: false,
    synthesisFailed: false,
    declineReason: null,
  }

  let stoppedNaturally = false
  let hadFatalFailure = false

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const priorStep = investigation.steps.at(-1) ?? null

    const stepSystemPrompt = buildResearchStepPlannerSystemPrompt({
      question,
      scope,
      context,
      stepIndex: stepIndex + 1,
      maxSteps,
      priorSteps: priorStepsSummary(investigation.steps),
      datasetAvailable: Boolean(datasetId),
      datasetUsed,
    })

    const { result: stepCall } = await runWithFallback(chain, (candidateId) =>
      streamChatCompletion({
        provider: getChatProvider(candidateId),
        messages: [{ role: 'user', content: question }],
        system: stepSystemPrompt,
        userId,
        workspaceId,
        feature: 'research-investigation-step',
        requestedProvider: chain[0],
      }),
    )

    const parsed = parseResearchStepResponse(stepCall.content)

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

    const stepId = crypto.randomUUID()
    let newStep: ResearchStep
    let newHypotheses: ResearchHypothesis[] = []

    if (parsed.status === 'analyze_dataset' && datasetId && !datasetUsed) {
      datasetUsed = true
      const { investigation: analysisInvestigation } = await runAnalysisInvestigation({
        datasetId,
        question: parsed.subQuestion,
        userId,
        workspaceId,
        chain,
      })

      const evidence: ResearchEvidence[] =
        analysisInvestigation.status === 'complete' || analysisInvestigation.steps.length > 0
          ? [
              {
                id: analysisInvestigation.id,
                source: { type: 'dataset_investigation', id: analysisInvestigation.id, title: parsed.subQuestion },
                excerpt: analysisInvestigation.synthesis ?? analysisInvestigation.declineReason ?? '(no synthesis produced)',
                similarity: null,
              },
            ]
          : []

      const observations = analysisInvestigation.steps.flatMap((s) =>
        s.observations.map((o) => ({ id: crypto.randomUUID(), stepId, statement: o.statement, evidenceIds: evidence.length > 0 ? [evidence[0]!.id] : [] })),
      )

      newStep = {
        id: stepId,
        index: stepIndex,
        kind: 'dataset_investigation',
        purpose: parsed.purpose,
        triggeredBy: priorStep?.id ?? null,
        query: parsed.subQuestion,
        evidence,
        observations,
        datasetInvestigation: analysisInvestigation,
      }

      newHypotheses = analysisInvestigation.hypotheses.map((h) => ({
        id: crypto.randomUUID(),
        statement: h.statement,
        supportingObservationIds: newStep.observations.map((o) => o.id),
        status: 'untested',
      }))
    } else {
      // Either a genuine search, or an analyze_dataset request that
      // arrived when no dataset is actually available (or already
      // used) — degrades honestly to a text search using the proposed
      // sub-question as the query, rather than fabricating a dataset
      // result that was never computed.
      const query = parsed.status === 'analyze_dataset' ? parsed.subQuestion : parsed.query
      const evidence = await gatherEvidence({ query, userId, workspaceId, documentId })

      let observations: ResearchStep['observations'] = []
      if (evidence.length > 0) {
        const { result: interpretCall } = await runWithFallback(chain, (candidateId) =>
          streamChatCompletion({
            provider: getChatProvider(candidateId),
            messages: [{ role: 'user', content: question }],
            system: buildEvidenceInterpreterSystemPrompt({ question, evidence }),
            userId,
            workspaceId,
            feature: 'research-evidence-interpretation',
            requestedProvider: chain[0],
          }),
        )
        observations = parseResearchObservationsResponse(interpretCall.content, stepId, evidence)
      }

      newStep = {
        id: stepId,
        index: stepIndex,
        kind: 'evidence_gathering',
        purpose: parsed.purpose,
        triggeredBy: priorStep?.id ?? null,
        query,
        evidence,
        observations,
        datasetInvestigation: null,
      }
    }

    investigation = { ...investigation, steps: [...investigation.steps, newStep], hypotheses: [...investigation.hypotheses, ...newHypotheses] }
    onStepComplete?.(investigation)
  }

  const stepLimitReached = !stoppedNaturally && !hadFatalFailure && investigation.steps.length === maxSteps

  if (investigation.steps.length === 0) {
    investigation = { ...investigation, status: 'failed', declineReason: 'No investigation step could be established.' }
    return { investigation }
  }

  investigation = { ...investigation, stepLimitReached }

  const sources = collectDistinctSources(investigation)
  const researchSummary = formatResearchForSynthesis(investigation)

  const { result: synthesisCall } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'research-synthesis',
      variables: { researchSummary },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const parsedSynthesis = parseResearchSynthesisResponse(synthesisCall.content, sources)

  investigation =
    parsedSynthesis === null
      ? { ...investigation, status: 'complete', synthesisFailed: true }
      : {
          ...investigation,
          status: 'complete',
          synthesisFailed: false,
          keyFindings: parsedSynthesis.keyFindings,
          synthesis: parsedSynthesis.synthesis,
          limitations: parsedSynthesis.limitations || null,
          comparisons: parsedSynthesis.comparisons,
          gaps: parsedSynthesis.gaps,
          followUpQuestions: parsedSynthesis.followUpQuestions,
        }

  onStepComplete?.(investigation)

  return { investigation }
}
