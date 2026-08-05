import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { buildContextTrace, type ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { retrieveGraphContext } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'
import { retrieveMemoryContext } from '@/modules/ai/memory/retrieveMemoryContext'
import { retrieveSpreadsheetContext } from '@/modules/processing/api/retrieveSpreadsheetContext'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexMessage } from '@/modules/search/indexing/indexMessage'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { resolveNovaContext } from '@/modules/intelligence/context/contextResolver'
import { buildNovaContextPrompt } from '@/modules/intelligence/buildNovaContextPrompt'
import { generateFollowUpSuggestions } from '@/modules/intelligence/conversation/generateFollowUpSuggestions'
import { detectSignals } from '@/modules/intelligence/signals/signalDetector'
import { buildReasoningPlan } from '@/modules/intelligence/planner/planner'
import type { ReasoningPlan } from '@/modules/intelligence/planner/plannerTypes'
import { isContinuationMessage } from '@/modules/intelligence/conversation/detectContinuation'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import { resolveReferences } from '@/modules/intelligence/references/referenceResolver'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import { runWorkspaceAction } from '@/modules/workspace-actions/registry'
import type { ArtifactPreview } from '@/modules/workspace-actions/types'
import { quotaService } from '@/shared/lib/quotaService'

export interface SendMessageParams {
  conversationId: string
  userId: string
  workspaceId: string | null
  /** Ordered candidates from useProviderChain — [0] is preferred, the rest are single-hop fallback order. */
  providerChain: string[]
  documentId?: string
  /** Prior turns in this conversation, oldest first — not including the new user message. */
  history: ChatProviderMessage[]
  text: string
  /** Called with the accumulated assistant text as it streams in. */
  onDelta?: (textSoFar: string) => void
}

export interface SendMessageResult {
  message: Message
  /** UX-6 Phase 5 — context-derived "would you like me to..." suggestions, never a fixed set. */
  suggestions: string[]
  /** Same counts UX-5.2 already logged internally — now returned so the UI can show "Used: ..." (Phase 7). */
  contextTrace: ContextTrace
  /** UX-6 Phase 6 — informational only, nothing here is auto-acted-on. */
  signals: IntelligenceSignal[]
  /** UX-7 Phase 2/3 — document/chapter chips resolved purely from this turn's retrieved chunk IDs, no AI/embedding involved. */
  references: Reference[]
  /** The provider's own reported model id (UX-7 Phase 5's "Explain My Answer" — previously computed but discarded). Null when the provider doesn't report one. */
  model: string | null
  /**
   * UX-14.2 (Planner Integration) — computed here, before the LLM call,
   * instead of after the response inside ChatPage (Architecture
   * Consolidation Sprint, Required Refactor R1). Not injected into the
   * prompt below — that's explicitly out of scope for this sprint; the
   * plan is only carried through so ChatPage can render it instead of
   * recomputing it a second time.
   */
  reasoningPlan: ReasoningPlan
  /** UX-14.4.3 — carried through unchanged from a Workspace Action's outcome; null on the normal chat path. Ephemeral UI signal only, never persisted. */
  artifactPreview: ArtifactPreview | null
}

/**
 * The single entry point for AI chat. ChatPage calls this, not a provider
 * directly — it resolves retrieval, prompt construction, and the provider
 * through the registries so the UI never talks to Claude/OpenAI/Gemini
 * (or even knows which one is selected) itself. `providerChain` is already
 * fully resolved (candidacy-filtered, preference-first, health-ordered) by
 * useProviderChain before this is called — this function just executes it
 * with single-hop fallback via runWithFallback, never re-deciding anything.
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { conversationId, userId, workspaceId, providerChain, documentId, history, text } = params

  const userMessage = await insertMessage({ conversationId, userId, role: 'user', content: text })
  void indexMessage(userMessage, workspaceId)
  void linkKnownConceptsToSource({ userId, sourceType: 'conversation', sourceId: conversationId, text })

  // AI Workspace Actions v1 — a recognized command (Generate Briefing, Save
  // to Notes, ...) short-circuits the normal retrieval/LLM-chat path
  // entirely (deterministic, no hallucination risk) rather than being just
  // another piece of prompt context. The router tries each registered
  // action's `match` in order; a null result means nothing matched and we
  // fall through to the normal chat path below.
  const actionOutcome = await runWorkspaceAction(text, { userId, workspaceId, conversationId, chain: providerChain })
  if (actionOutcome) {
    const assistantMessage = await insertMessage({
      conversationId,
      userId,
      role: 'assistant',
      content: actionOutcome.responseText,
    })
    void indexMessage(assistantMessage, workspaceId)
    await touchConversation(conversationId)

    return {
      message: assistantMessage,
      suggestions: [],
      contextTrace: { retrievedChunks: 0, graphNodes: actionOutcome.references?.length ? 1 : 0, memoriesUsed: 0 },
      signals: [],
      references: actionOutcome.references ?? [],
      model: null,
      // This path deliberately short-circuits retrieval/resolveNovaContext
      // entirely, so hasInProgressDocument/hasMemoryContext stay false
      // rather than adding a new fetch to a pipeline designed to skip the
      // normal one; hasGraphContext mirrors the same signal contextTrace
      // above already reports for this branch.
      reasoningPlan: buildReasoningPlan({
        text,
        signals: {
          hasInProgressDocument: false,
          hasMemoryContext: false,
          hasGraphContext: Boolean(actionOutcome.references?.length),
          isContinuation: isContinuationMessage(text),
        },
      }),
      // UX-14.4.3 — carried straight through from the action's outcome, no
      // transformation: responseText (persisted above, unchanged) remains
      // the source of truth for save/reload; this is purely additive.
      artifactPreview: actionOutcome.artifactPreview ?? null,
    }
  }

  const matches = await retrieveContext({ query: text, userId, workspaceId, documentId })
  // retrieveGraphContext/retrieveMemoryContext never throw (see their own
  // try/catch) — a missing or empty knowledge graph or memory store just
  // means no <knowledge_connections>/<personal_context> block, never a
  // broken chat response.
  const graphContext = await retrieveGraphContext({
    documentIds: [...new Set(matches.map((match) => match.documentId))],
    userId,
    workspaceId,
  })
  const memoryContext = await retrieveMemoryContext({ userId, workspaceId })
  // UX-13.10 — same never-throws contract as graph/memory context; scoped
  // to `documentId` specifically (not the matched chunks' documents) since
  // this is only meaningful when the reader/chat is actually anchored to
  // one spreadsheet, same scoping retrieveContext itself already uses.
  const spreadsheetContext = await retrieveSpreadsheetContext(documentId)
  let system = buildSystemPrompt(matches, graphContext, memoryContext, spreadsheetContext)

  const contextTrace = buildContextTrace(matches.length, graphContext, memoryContext)
  // Internal-only, logged not persisted (Phase UX-5.2) — "why did NOVA
  // answer this way" isn't user- or UI-facing yet, that's a later phase.
  console.debug('[AIService] context trace', contextTrace)

  // UX-6: the NOVA Context Engine + personality/situational prompt layer.
  // resolveNovaContext never throws by design (every source is its own
  // try/catch) — matching that same "must never break chat" contract, so
  // this stays additive to the UX-5.2 prompt above, never a replacement.
  const novaContext = await resolveNovaContext({
    userId,
    workspaceId,
    graphContextText: graphContext,
    memoryContextText: memoryContext,
  })
  // UX-14.2 (Planner Integration) — same PlannerSignals shape and
  // derivation ChatPage used to compute after the response arrived,
  // moved here so it runs before the LLM call. hasInProgressDocument now
  // reads resolveNovaContext's activityContext instead of the client's
  // separately-cached commandContext — same underlying
  // getMostRecentReadingProgress query, not a new signal source.
  // Deliberately not appended to `system` below — carrying the plan
  // through the return value is this sprint's entire scope.
  const reasoningPlan = buildReasoningPlan({
    text,
    signals: {
      hasInProgressDocument: Boolean(novaContext.activityContext?.inProgressDocument),
      hasMemoryContext: contextTrace.memoriesUsed > 0,
      hasGraphContext: contextTrace.graphNodes > 0,
      isContinuation: isContinuationMessage(text),
    },
  })
  system = `${system}\n\n${buildNovaContextPrompt(novaContext, text)}`

  const quota = await quotaService.checkQuota(userId, 'ai_messages')

if (!quota.allowed) {
  throw new Error(
    quota.reason ?? 'AI quota limit reached',
  )
}
  const { result } = await runWithFallback(providerChain, (candidateId) =>
    streamChatCompletion({
      provider: getChatProvider(candidateId),
      messages: [...history, { role: 'user', content: text }],
      system,
      userId,
      workspaceId,
      feature: 'chat',
      requestedProvider: providerChain[0],
      onDelta: params.onDelta,
    }),
  )

  const assistantMessage = await insertMessage({
    conversationId,
    userId,
    role: 'assistant',
    content: result.content,
    contextChunkIds: matches.map((match) => match.chunkId),
  })
  void indexMessage(assistantMessage, workspaceId)
  void linkKnownConceptsToSource({ userId, sourceType: 'conversation', sourceId: conversationId, text: result.content })

  await touchConversation(conversationId)
  
  await quotaService.consumeQuota(userId, 'ai_messages')

  // UX-7 Phase 2 — resolveReferences never throws (see its own try/catch-
  // free but purely-additive design: no matches means [] immediately);
  // still guarded here since a Supabase hiccup on this lookup must not
  // turn a successful answer into a failed one.
  const references = await resolveReferences({ matches }).catch(() => [])

  return {
    message: assistantMessage,
    suggestions: generateFollowUpSuggestions({ matchCount: matches.length, context: novaContext }),
    contextTrace,
    signals: detectSignals({
      context: novaContext,
      matchCount: matches.length,
      documentId: documentId ?? null,
      responseLength: result.content.length,
    }),
    references,
    model: result.model,
    reasoningPlan,
    // UX-14.4.3 — the normal chat path never produces a structured
    // artifact preview; only a Workspace Action outcome can (see the
    // branch above).
    artifactPreview: null,
  }
}
