import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { retrieveAssetContext } from '@/modules/ai/orchestration/retrieveAssetContext'
import { retrieveNoteContext } from '@/modules/ai/orchestration/retrieveNoteContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { buildContextTrace, type ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { retrieveGraphContext } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'
import { retrieveNamedEntityGraphContext } from '@/modules/knowledge-intelligence/api/retrieveNamedEntityGraphContext'
import { retrieveMemoryContext } from '@/modules/ai/memory/retrieveMemoryContext'
import { retrieveSpreadsheetContext } from '@/modules/processing/api/retrieveSpreadsheetContext'
import { resolveChunkProvenance } from '@/modules/ai/orchestration/resolveChunkProvenance'
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
import { ChatSendFailure, QuotaDeniedError } from '@/modules/ai/orchestration/chatSendErrors'

const embeddingProvider = new OpenAIEmbeddingProvider()

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
  /**
   * Set by useSendMessage's retry path when this call is re-attempting a
   * turn that already got as far as persisting the user's message before
   * failing — skips insertMessage (and its indexMessage/
   * linkKnownConceptsToSource side effects) so retrying a failed send
   * never creates a duplicate user message row.
   */
  existingUserMessage?: Message
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
  const { conversationId, userId, workspaceId, providerChain, documentId, history, text, existingUserMessage } = params

  // A retry of a previously-failed send already has this row (see
  // ChatSendFailure/useSendMessage) — reusing it instead of inserting again
  // is what keeps Retry from ever duplicating the user's turn.
  const userMessage = existingUserMessage ?? (await insertMessage({ conversationId, userId, role: 'user', content: text }))
  if (!existingUserMessage) {
    void indexMessage(userMessage, workspaceId)
    void linkKnownConceptsToSource({ userId, sourceType: 'conversation', sourceId: conversationId, text })
  }

  // Everything below this point can fail (quota, retrieval, the provider
  // call itself) after userMessage has already been persisted — wrapping
  // it all in ChatSendFailure carries that row back to the caller so a
  // subsequent retry can pass it in as existingUserMessage above instead of
  // inserting a second one.
  try {
    return await sendMessageAfterUserTurn({ conversationId, userId, workspaceId, providerChain, documentId, history, text, userMessage, onDelta: params.onDelta })
  } catch (err) {
    throw new ChatSendFailure(err, userMessage)
  }
}

async function sendMessageAfterUserTurn(params: {
  conversationId: string
  userId: string
  workspaceId: string | null
  providerChain: string[]
  documentId?: string
  history: ChatProviderMessage[]
  text: string
  userMessage: Message
  onDelta?: (textSoFar: string) => void
}): Promise<SendMessageResult> {
  const { conversationId, userId, workspaceId, providerChain, documentId, history, text } = params

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
    
await quotaService.consumeQuota(userId, 'ai_messages')
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

  // PIP Sprint 9/10 — fail fast on quota before doing any retrieval or
  // embedding work: previously this check ran after the entire block
  // below, so a user who was already over quota still paid for a full
  // retrieval pass (multiple DB round trips, an embedding call) on every
  // rejected turn. checkQuota depends on nothing computed below, so
  // nothing is lost by asking first.
  const quota = await quotaService.checkQuota(userId, 'ai_messages')
  if (!quota.allowed) {
    throw new QuotaDeniedError(quota.reason ?? 'AI quota limit reached')
  }

  // PIP Sprint 9/10 — retrieveContext, retrieveAssetContext, and
  // retrieveNoteContext each independently embedded this exact same query
  // text, three real OpenAI embedding calls (network round trips and
  // billed tokens) for one identical string. Embed it once here and share
  // the result — see each function's own `embedding` param.
  const [queryEmbedding] = await embeddingProvider.embed([text], { userId, workspaceId, feature: 'retrieval' })

  // PIP Sprint 9/10 — these six sources are mutually independent (none
  // consumes another's result), so they now run concurrently instead of
  // one blocking the next — previously ~6 sequential network round trips
  // per turn. assetMatches/noteMatches keep their own per-call .catch()
  // (PIP Stabilization v1 / Sprint 7/10 / Sprint 8/10 — never throws, a
  // failure just means no <visual_context>/<note_context> block) so one
  // source rejecting can't fail the whole Promise.all batch;
  // retrieveGraphContext/retrieveNamedEntityGraphContext/
  // retrieveMemoryContext/retrieveSpreadsheetContext already never throw
  // internally (see their own try/catch), unchanged by running them in
  // parallel here instead of in sequence.
  const [matches, assetMatches, noteMatches, namedEntityGraphContext, memoryContext, spreadsheetContext] = await Promise.all([
    retrieveContext({ query: text, userId, workspaceId, documentId, embedding: queryEmbedding }),
    retrieveAssetContext({ query: text, userId, workspaceId, embedding: queryEmbedding }).catch((err: unknown) => {
      console.error('retrieveAssetContext failed — chat continues without visual_context:', err)
      return []
    }),
    retrieveNoteContext({ query: text, userId, workspaceId, embedding: queryEmbedding }).catch((err: unknown) => {
      console.error('retrieveNoteContext failed — chat continues without note_context:', err)
      return []
    }),
    // PIP Sprint 5/10 — a question naming an entity directly ("What is
    // ARRIYIA connected to?") deserves that entity's real graph evidence
    // even when no chunk search happened to surface the right document.
    // Independent of `matches` (unlike chunkSourcedGraphContext below,
    // which needs it), so it belongs in this first parallel batch.
    retrieveNamedEntityGraphContext({ text, userId }),
    retrieveMemoryContext({ userId, workspaceId, text }),
    // UX-13.10 — scoped to `documentId` specifically (not the matched
    // chunks' documents), so it doesn't depend on `matches` either.
    retrieveSpreadsheetContext(documentId),
  ])

  // PIP Sprint 9/10 — these two DO depend on the batch above
  // (chunkSourcedGraphContext needs matches/assetMatches' ids;
  // chunkProvenance needs matches' chunk/document ids), so they're a
  // second stage — but they're independent of EACH OTHER, so they still
  // run concurrently rather than one blocking the other.
  const [chunkSourcedGraphContext, chunkProvenance] = await Promise.all([
    // PIP Stabilization v1 (P0, root cause B) — without assetIds, an
    // image's own knowledge-graph relationships (concepts/entities
    // extracted from it) were unreachable even when the image itself was
    // found above. Never throws (see its own try/catch).
    retrieveGraphContext({
      documentIds: [...new Set(matches.map((match) => match.documentId))],
      assetIds: [...new Set(assetMatches.map((match) => match.assetId))],
      userId,
      workspaceId,
    }),
    // PIP Sprint 4/10 — resolved before buildSystemPrompt (not after, the
    // way resolveReferences below is) so the model itself can see which
    // document/page each excerpt came from, not just the UI's reference
    // chips. Never throws (see its own try/catch).
    resolveChunkProvenance(matches),
  ])
  // PIP Sprint 5/10 — both blocks use the identical "Concept:"/"Entity:"
  // line convention, so buildContextTrace's node counting stays accurate
  // across either source.
  const graphContext = [chunkSourcedGraphContext, namedEntityGraphContext].filter((block): block is string => Boolean(block)).join('\n\n') || null
  let system = buildSystemPrompt(matches, graphContext, memoryContext, spreadsheetContext, assetMatches, chunkProvenance, noteMatches)

  const contextTrace = buildContextTrace(matches.length + assetMatches.length + noteMatches.length, graphContext, memoryContext)
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
