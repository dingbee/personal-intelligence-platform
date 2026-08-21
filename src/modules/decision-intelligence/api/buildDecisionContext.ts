import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { gatherEvidence } from '@/modules/research-intelligence/gatherEvidence'
import { listStructuredDatasetsForDocument } from '@/modules/data-intelligence/api/structuredDatasets'
import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { IntelligenceOperation } from '@/shared/lib/intelligenceOperations'
import type { PlanDerivedDecisionContext } from '@/modules/decision-intelligence/api/adaptPlanForDecisionContext'
import type { DecisionContextSource, DecisionContextSourceType } from '@/modules/decision-intelligence/decision'

const MAX_WORKSPACE_OBJECTIVES = 5

export interface DecisionContext {
  question: string
  objective: string | null
  userConstraints: string[]
  activeWorkspaceObjectives: string[]
  relevantEvidence: DecisionContextSource[]
  /** Set only when the caller passed an originating Plan — see adaptPlanForDecisionContext.ts. Null for a standalone decision with no planning context. */
  planContext: PlanDerivedDecisionContext | null
  /** Set only when `documentId` was supplied and that document has a real structured dataset — see the module doc comment below. */
  datasetInvestigation: AnalysisInvestigation | null
}

/**
 * Selective context assembly for Decision Intelligence — same
 * discipline as Planning Intelligence's own buildPlanningContext.ts
 * (never a full knowledge-base dump): active workspace objectives, one
 * bounded gatherEvidence retrieval pass against the decision question,
 * a plan's own objective/milestones/constraints/risks/assumptions when
 * deciding in service of an existing plan (Phase 14, via the one-way
 * adaptPlanForDecisionContext.ts mapping), and — when `documentId` names
 * a document with a real structured dataset — one bounded delegation to
 * Analysis Intelligence's own runAnalysisInvestigation (unmodified,
 * `parentOperation:operation` so it shares this decision's own AI-call
 * budget/quota rather than opening a second one), exactly the same
 * "Research Intelligence delegates to Analysis for a deterministic
 * number" pattern runResearchInvestigation.ts already established. This
 * is what lets a decision whose criteria include something like cost —
 * the sprint brief's own acceptance-test shape — be grounded in an
 * actually-computed number from the user's own uploaded data, not a
 * document/note snippet's prose paraphrase of one.
 */
export async function buildDecisionContext(params: {
  question: string
  objective?: string | null
  userConstraints?: string[]
  userId: string
  workspaceId: string | null
  plan?: PlanDerivedDecisionContext | null
  documentId?: string | null
  chain: string[]
  operation: IntelligenceOperation
}): Promise<DecisionContext> {
  const { question, objective = null, userConstraints = [], userId, workspaceId, plan = null, documentId = null, chain, operation } = params
  const subQuestion = objective ? `${question} ${objective}` : question

  const [activeObjectives, evidence, datasetId] = await Promise.all([
    workspaceId ? listWorkspaceObjectives(workspaceId) : Promise.resolve([]),
    gatherEvidence({ query: subQuestion, userId, workspaceId, documentId: documentId ?? undefined }),
    documentId ? listStructuredDatasetsForDocument(documentId).then((datasets) => datasets[0]?.id ?? null) : Promise.resolve(null),
  ])

  let datasetInvestigation: AnalysisInvestigation | null = null
  if (datasetId) {
    ;({ investigation: datasetInvestigation } = await runAnalysisInvestigation({ datasetId, question: subQuestion, userId, workspaceId, chain, parentOperation: operation }))
  }

  const relevantEvidence: DecisionContextSource[] = evidence.map((e) => ({ id: e.id, type: e.source.type as DecisionContextSourceType, title: e.source.title, excerpt: e.excerpt }))
  if (datasetInvestigation && (datasetInvestigation.status === 'complete' || datasetInvestigation.steps.length > 0)) {
    relevantEvidence.push({
      id: datasetInvestigation.id,
      type: 'dataset_investigation',
      title: subQuestion,
      excerpt: datasetInvestigation.synthesis ?? datasetInvestigation.declineReason ?? '(no synthesis produced)',
    })
  }

  return {
    question,
    objective,
    userConstraints,
    activeWorkspaceObjectives: activeObjectives
      .filter((o) => o.status === 'active')
      .slice(0, MAX_WORKSPACE_OBJECTIVES)
      .map((o) => o.content),
    relevantEvidence,
    planContext: plan,
    datasetInvestigation,
  }
}
