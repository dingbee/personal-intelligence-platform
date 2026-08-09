import type { Conversation, Message } from '@/shared/types/database'
import type { ExportContent } from '@/modules/export/types'

const ROLE_LABEL: Partial<Record<Message['role'], string>> = { user: 'You', assistant: 'ARRIYIA' }

/**
 * Pure — takes an already-fetched conversation and its already-fetched
 * messages (both already loaded on `ChatPage`), no fetch here. Only the
 * title and each message's role label + content ever reach
 * `ExportContent` — no `id`/`user_id`/`workspace_id`/`document_id`/
 * `provider_id`/`context_chunk_ids`, the same allow-list discipline
 * `exportConversationPackage` already established for the NOVA Package
 * path (UX-14.5.12 §1/§3): system messages are filtered out and no AI
 * metadata (model, temperature, retrieval context) is ever included.
 */
export function buildConversationExportContent(conversation: Conversation, messages: Message[]): ExportContent {
  const transcriptLines = messages
    .filter((message): message is Message & { role: 'user' | 'assistant' } => message.role === 'user' || message.role === 'assistant')
    .map((message) => `${ROLE_LABEL[message.role]}: ${message.content}`)

  return {
    title: conversation.title,
    subtitle: `${transcriptLines.length} message${transcriptLines.length === 1 ? '' : 's'}`,
    sections: [{ body: transcriptLines.length > 0 ? transcriptLines : ['No messages in this conversation.'] }],
  }
}
