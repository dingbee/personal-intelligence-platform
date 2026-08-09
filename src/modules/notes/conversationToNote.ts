import type { MessageRole } from '@/shared/types/database'

export type ConversationSaveScope = 'entire' | 'selected' | 'ai-only' | 'user-only'

export interface ConversationNoteMessage {
  id: string
  role: MessageRole
  content: string
  context_chunk_ids: string[]
}

export interface FilterMessagesForScopeInput {
  messages: ConversationNoteMessage[]
  scope: ConversationSaveScope
  /** Only consulted when scope is 'selected'. */
  selectedMessageIds?: ReadonlySet<string>
}

/** UX-13.7.2 — the four scopes from the "Save conversation" flow: entire conversation, AI answers only, my messages only, or an explicit selection. Order preserved (conversation order in, same order out). */
export function filterMessagesForScope(input: FilterMessagesForScopeInput): ConversationNoteMessage[] {
  switch (input.scope) {
    case 'entire':
      return input.messages
    case 'ai-only':
      return input.messages.filter((m) => m.role === 'assistant')
    case 'user-only':
      return input.messages.filter((m) => m.role === 'user')
    case 'selected':
      return input.messages.filter((m) => input.selectedMessageIds?.has(m.id))
  }
}

const ROLE_LABEL: Partial<Record<MessageRole, string>> = { user: 'You', assistant: 'ARRIYIA' }

/** Renders the chosen messages as note content — plain, readable markdown-ish text, not a literal chat-UI transcript. System messages (never shown in the chat UI itself) are skipped rather than labeled. */
export function formatConversationAsNoteContent(messages: ConversationNoteMessage[]): string {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => `**${ROLE_LABEL[m.role]}:** ${m.content}`)
    .join('\n\n')
}

/** Every distinct context_chunk_id across the saved messages — the same "traceable to what it was created from" provenance HighlightsList's createNoteFromHighlight already gives hand-written notes from a highlight. */
export function collectSourceChunkIds(messages: ConversationNoteMessage[]): string[] {
  const ids = new Set<string>()
  for (const message of messages) {
    for (const chunkId of message.context_chunk_ids) ids.add(chunkId)
  }
  return [...ids]
}
