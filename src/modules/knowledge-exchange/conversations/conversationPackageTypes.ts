import type { MessageRole } from '@/shared/types/database'

/**
 * UX-14.5.12 — the one, versioned shape a Conversation export/import
 * package takes, following `notes/notePackageTypes.ts`'s exact pattern.
 * Allow-list, not deny-list: only the fields listed here can ever leave a
 * conversation in a package.
 *
 * Deliberately excludes `id`/`user_id`/`workspace_id`/`document_id`
 * (internal ids and account-specific links — the linked document may not
 * exist, or exist at all, in the importer's account), `provider_id`
 * (which model answered — system configuration, not user-facing
 * knowledge, per this task's own §3 recommendation: "preserve only
 * user-facing context"), and `is_pinned`/`favorite`/`color`/`icon`
 * (personal UI-state preferences, not conversation content — Notes'/
 * Knowledge Nodes' own packages carry no equivalent UI-state fields
 * either).
 *
 * A message's own `id`/`conversation_id`/`user_id` are excluded for the
 * same reason; `context_chunk_ids` is excluded because it references
 * chunks that only exist in the exporting account — meaningless
 * cross-account, the identical reasoning `notePackageTypes.ts` already
 * documents for Notes' own `source_chunk_ids`. Only `'user'`/`'assistant'`
 * messages ever appear here — a hypothetical `'system'` role message
 * (never produced by the current chat pipeline, but a real value
 * `MessageRole` allows) is never user-facing content and is excluded on
 * export, the same "never shown, never exported" treatment
 * `conversationToNote.ts`'s own message formatter already gives it.
 *
 * No model/temperature/tool-calls/citations/retrieved-context ever
 * travels — none of those are persisted as columns on `messages` or
 * `conversations` at all (confirmed by reading `useSendMessage.ts`: the
 * model, retrieval trace, and reasoning plan are transient in-memory
 * state for the current render only), so there's nothing here to
 * accidentally forward even if a future field were added carelessly.
 */
export interface ConversationMessagePayload {
  role: Extract<MessageRole, 'user' | 'assistant'>
  content: string
  /** The original message's own timestamp, preserved as inert metadata only — never used to set the imported row's own `created_at`, which reflects when *this account* actually received it. Message ordering on import is reconstructed from array order, not from this field. */
  createdAt: string
}

export interface ConversationPackagePayload {
  title: string
  createdAt: string
  updatedAt: string
  messages: ConversationMessagePayload[]
}

export interface ConversationPackage {
  version: number
  exportedAt: string
  sourceVersion: string
  conversation: ConversationPackagePayload
}
