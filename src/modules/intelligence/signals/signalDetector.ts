import type { NovaContext } from '@/modules/intelligence/context/types'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

export interface DetectSignalsParams {
  context: NovaContext
  matchCount: number
  /** The document this conversation is scoped to, if any (ChatPage's ?documentId / ReaderChatPanel). */
  documentId?: string | null
  responseLength: number
}

/** Long enough that "create a note" is a plausible next step, not every one-line reply. */
const SUBSTANTIVE_RESPONSE_LENGTH = 400

/**
 * UX-6 Phase 6: pure, deterministic — derives lightweight signals from
 * this turn's already-resolved NovaContext plus a couple of cheap local
 * facts (match count, response length, which document this chat is
 * scoped to). No new queries, no AI call, no persistence.
 */
export function detectSignals(params: DetectSignalsParams): IntelligenceSignal[] {
  const { context, matchCount, documentId, responseLength } = params
  const signals: IntelligenceSignal[] = []

  const inProgress = context.activityContext?.inProgressDocument
  if (inProgress && documentId && inProgress.id === documentId) {
    signals.push({ type: 'reading_resumed', message: `Reading resumed: "${inProgress.title}".` })
  }

  if (matchCount === 0) {
    signals.push({
      type: 'knowledge_gap_detected',
      message: "No matching content found in the user's library for this question.",
    })
  }

  const currentTopic = context.workspaceContext?.workspaceName
  if (currentTopic && context.activityContext?.recentConversationTitles.some((title) => title === currentTopic)) {
    signals.push({ type: 'repeated_topic_detected', message: `"${currentTopic}" has come up in a recent conversation.` })
  }

  if (matchCount > 0 && responseLength >= SUBSTANTIVE_RESPONSE_LENGTH) {
    signals.push({ type: 'possible_note_creation', message: 'This response may be worth saving as a note.' })
  }

  if (context.knowledgeContext) {
    signals.push({ type: 'related_concept_discovered', message: 'Related concepts found in the knowledge graph.' })
  }

  return signals
}
