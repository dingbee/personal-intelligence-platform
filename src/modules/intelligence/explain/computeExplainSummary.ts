import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { inferResponseStyleHint, type ResponseStyleHint } from '@/modules/intelligence/personality/responseStyle'
import { isContinuationMessage } from '@/modules/intelligence/conversation/detectContinuation'

export interface ExplainSummary {
  documentsUsed: number
  knowledgeGraphUsed: boolean
  graphNodeCount: number
  memoriesUsed: boolean
  memoryCount: number
  workspaceName: string | null
  isContinuation: boolean
  responseStyle: ResponseStyleHint
  model: string
}

/**
 * UX-7 Phase 5 — "Why did NOVA answer this?" Every field here is derived
 * from data UX-5.2/UX-6 already computed (contextTrace) or from pure
 * functions already built in UX-6 (isContinuationMessage,
 * inferResponseStyleHint) — no new tracking invented, per the brief.
 */
export function computeExplainSummary(params: {
  contextTrace: ContextTrace
  workspaceName: string | null
  userQuery: string
  model: string
}): ExplainSummary {
  const { contextTrace } = params
  return {
    documentsUsed: contextTrace.retrievedChunks,
    knowledgeGraphUsed: contextTrace.graphNodes > 0,
    graphNodeCount: contextTrace.graphNodes,
    memoriesUsed: contextTrace.memoriesUsed > 0,
    memoryCount: contextTrace.memoriesUsed,
    workspaceName: params.workspaceName,
    isContinuation: isContinuationMessage(params.userQuery),
    responseStyle: inferResponseStyleHint(params.userQuery),
    model: params.model,
  }
}
