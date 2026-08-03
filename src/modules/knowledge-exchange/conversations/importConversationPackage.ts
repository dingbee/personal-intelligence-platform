import { createConversation } from '@/modules/ai/chat/api/conversations'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { indexMessage } from '@/modules/search/indexing/indexMessage'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import type { Conversation } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

/**
 * Always `createConversation` (insert) — never an update/upsert against
 * an existing row — so an import can never overwrite an existing
 * conversation by construction, not by a defensive check. The importer
 * becomes the owner (`userId` from context, exactly like every other
 * "create a conversation" path in this app — the same contract
 * `duplicateConversation` already establishes for in-account cloning);
 * a fresh id comes from the same `insert()` path every other create
 * operation already uses. `provider_id` is left to `createConversation`'s
 * own default (`DEFAULT_CHAT_PROVIDER_ID`) — the exporter's original
 * model choice never travels, per this task's own "preserve only
 * user-facing context" recommendation.
 *
 * Messages are inserted one at a time (not via `Promise.all`), exactly
 * like `duplicateConversation` already does, so their `created_at`
 * ordering — the only thing `listMessages` sorts by — matches the
 * package's own array order. After each message is inserted, this reruns
 * the identical fire-and-forget integration steps `AIService.sendMessage`
 * already runs for a live turn: `indexMessage` (regenerates a fresh
 * embedding from the imported plain-text content — never copies one,
 * the same "regenerate not transfer" rule every prior package type's own
 * derived content already follows) and `linkKnownConceptsToSource`
 * (evidence-links the imported text against the importer's own existing
 * knowledge nodes). An imported conversation is, from the moment this
 * function returns, indistinguishable at the database level from one the
 * importer built by chatting normally — same reuse discipline
 * `importNotePackage.ts` already established for Notes.
 *
 * No import provenance can be recorded on either row — `conversations`
 * and `messages` both have no metadata JSONB column at all, the same
 * documented, accepted MVP limitation Asset Exchange's own discovery
 * already found and accepted for `assets` (§ assetPackageTypes.ts).
 * "No migrations" is a hard constraint this phase too, so this is
 * accepted rather than worked around.
 */
export async function importConversationPackage(pkg: ConversationPackage, context: PackageImportContext): Promise<Conversation> {
  const conversation = await createConversation({
    userId: context.userId,
    workspaceId: context.workspaceId,
    title: pkg.conversation.title,
  })

  for (const message of pkg.conversation.messages) {
    const inserted = await insertMessage({
      conversationId: conversation.id,
      userId: context.userId,
      role: message.role,
      content: message.content,
    })
    void indexMessage(inserted, context.workspaceId)
    void linkKnownConceptsToSource({ userId: context.userId, sourceType: 'conversation', sourceId: conversation.id, text: message.content })
  }

  return conversation
}

export const conversationPackageImporter: PackageImporter<ConversationPackage, Conversation> = {
  import: importConversationPackage,
}
