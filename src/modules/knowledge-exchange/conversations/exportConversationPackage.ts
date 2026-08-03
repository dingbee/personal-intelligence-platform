import type { Conversation, Message } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

/**
 * Pure — takes an already-fetched conversation and its already-fetched
 * messages (both already loaded on `ChatPage`), builds the versioned
 * package. No Supabase call here, matching every other package type's
 * "exporters never fetch data themselves" discipline.
 *
 * `'system'`-role messages are filtered out — never user-facing content
 * (see `conversationPackageTypes.ts`'s own doc-comment) — and message
 * order is preserved exactly as `listMessages` already returns it
 * (ascending `created_at`).
 */
export function exportConversationPackage(source: { conversation: Conversation; messages: Message[] }): ConversationPackage {
  const { conversation, messages } = source
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    conversation: {
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messages: messages
        .filter((message): message is Message & { role: 'user' | 'assistant' } => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({ role: message.role, content: message.content, createdAt: message.created_at })),
    },
  }
}

export const conversationPackageExporter: PackageExporter<{ conversation: Conversation; messages: Message[] }, ConversationPackage> = {
  export: exportConversationPackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same slugify pattern every prior package type's own filename helper already established. */
export function conversationPackageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'conversation-export'}.json`
}
