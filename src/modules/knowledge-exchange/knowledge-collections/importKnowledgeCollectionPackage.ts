import { createKnowledgeCollection, addItemToCollection } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { importKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'
import { importNotePackage } from '@/modules/knowledge-exchange/notes/importNotePackage'
import { importAssetPackage } from '@/modules/knowledge-exchange/assets/importAssetPackage'
import { importDocumentPackage } from '@/modules/knowledge-exchange/documents/importDocumentPackage'
import { importConversationPackage } from '@/modules/knowledge-exchange/conversations/importConversationPackage'
import { importKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { ValidatedCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import type { CollectionMemberEntry, CollectionMemberType } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import type { KnowledgeCollection } from '@/shared/types/database'

export interface CollectionMemberImportOutcome {
  memberType: CollectionMemberType
  title: string
  outcome: 'imported' | 'skipped' | 'failed'
  /** Only meaningful for `knowledge_node` members — mirrors `ImportKnowledgeNodePackageResult`'s own "created vs. matched an existing concept" distinction, the one member type with a real dedup resolver (§2.1/§3.8 of the discovery). */
  matched?: boolean
  error?: string
}

export interface CollectionRelationshipImportOutcome {
  relationshipType: string
  sourceTitle: string
  targetTitle: string
  outcome: 'imported' | 'failed'
  error?: string
}

export interface ImportKnowledgeCollectionPackageResult {
  collection: KnowledgeCollection
  members: CollectionMemberImportOutcome[]
  relationships: CollectionRelationshipImportOutcome[]
}

/** The original member's own title, known upfront from its payload regardless of whether import ultimately succeeds — used both for the success report and, on failure, since a thrown import never returns a fresh row to read a title from. */
function memberTitle(member: CollectionMemberEntry): string {
  switch (member.memberType) {
    case 'knowledge_node':
      return member.payload.node.title
    case 'note':
      return member.payload.note.title
    case 'asset':
      return member.payload.asset.title
    case 'document':
      return member.payload.document.title
    case 'conversation':
      return member.payload.conversation.title
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong importing this member.'
}

/**
 * UX-14.5.10.6 — the Collection import algorithm, per the discovery's §3.
 *
 * 1. The collection row is always created first (`createKnowledgeCollection`,
 *    unmodified) — it has no dependency on any member resolving, and the
 *    importer becomes its owner with the caller's own explicit workspace
 *    choice, exactly like every other package type's `PackageImportContext`.
 * 2. Every member resolves independently, each through that type's own
 *    existing, unmodified importer (`importKnowledgeNodePackage`/
 *    `importNotePackage`/`importAssetPackage`/`importDocumentPackage`/
 *    `importConversationPackage`, UX-14.5.12). On success, a
 *    `knowledge_links` membership row is added (`addItemToCollection`,
 *    unmodified) pointing the new collection at the fresh (or reused, for
 *    knowledge nodes) member id.
 * 3. **A single member's failure never aborts the whole import** — caught
 *    per member, recorded, and the loop continues. This is the discovery's
 *    §3.4 partial-success policy, deliberately different from Knowledge
 *    Link Exchange's own all-or-nothing rule: a relationship without both
 *    endpoints is meaningless (atomic), but a collection is a container of
 *    many independent things, so one corrupted embedded Document
 *    shouldn't discard every other member that already imported cleanly.
 * 4. Auxiliary `relationships` (§2.6) replay only *after* every member has
 *    been attempted, via the unmodified `importKnowledgeLinkPackage` —
 *    which independently re-resolves both endpoints by title, so it
 *    correctly lands on whichever `knowledge_node` members this same
 *    import just created or matched. Each relationship's own failure is
 *    caught and reported the same way, never aborting the rest.
 * 5. No rollback: a partially-completed collection (the row exists, some
 *    members are linked, some failed/were skipped) is the intended,
 *    reported outcome, not an error state to unwind (§3.6).
 */
export async function importKnowledgeCollectionPackage(
  pkg: ValidatedCollectionPackage,
  context: PackageImportContext,
): Promise<ImportKnowledgeCollectionPackageResult> {
  const { manifest, documentMembers } = pkg

  const collection = await createKnowledgeCollection({
    userId: context.userId,
    workspaceId: context.workspaceId,
    name: manifest.collection.name,
    description: manifest.collection.description ?? undefined,
  })

  const members: CollectionMemberImportOutcome[] = []

  for (const member of manifest.collection.members) {
    const title = memberTitle(member)

    try {
      if (member.memberType === 'knowledge_node') {
        const { node, created } = await importKnowledgeNodePackage(member.payload, context)
        await addItemToCollection({ userId: context.userId, workspaceId: context.workspaceId, collectionId: collection.id, itemType: 'knowledge_node', itemId: node.id })
        members.push({ memberType: 'knowledge_node', title, outcome: 'imported', matched: !created })
      } else if (member.memberType === 'note') {
        const note = await importNotePackage(member.payload, context)
        await addItemToCollection({ userId: context.userId, workspaceId: context.workspaceId, collectionId: collection.id, itemType: 'note', itemId: note.id })
        members.push({ memberType: 'note', title, outcome: 'imported' })
      } else if (member.memberType === 'asset') {
        const asset = await importAssetPackage(member.payload, context)
        await addItemToCollection({ userId: context.userId, workspaceId: context.workspaceId, collectionId: collection.id, itemType: 'asset', itemId: asset.id })
        members.push({ memberType: 'asset', title, outcome: 'imported' })
      } else if (member.memberType === 'document') {
        const validatedDocument = documentMembers.get(member.archiveEntry)
        if (!validatedDocument) throw new Error('This document member is missing its archive content.')
        const document = await importDocumentPackage(validatedDocument, context)
        await addItemToCollection({ userId: context.userId, workspaceId: context.workspaceId, collectionId: collection.id, itemType: 'document', itemId: document.id })
        members.push({ memberType: 'document', title, outcome: 'imported' })
      } else {
        const conversation = await importConversationPackage(member.payload, context)
        await addItemToCollection({ userId: context.userId, workspaceId: context.workspaceId, collectionId: collection.id, itemType: 'conversation', itemId: conversation.id })
        members.push({ memberType: 'conversation', title, outcome: 'imported' })
      }
    } catch (error) {
      members.push({ memberType: member.memberType, title, outcome: 'failed', error: errorMessage(error) })
    }
  }

  const relationships: CollectionRelationshipImportOutcome[] = []
  for (const relationship of manifest.collection.relationships) {
    const { relationshipType, source, target } = relationship.link
    try {
      await importKnowledgeLinkPackage(relationship, context)
      relationships.push({ relationshipType, sourceTitle: source.title, targetTitle: target.title, outcome: 'imported' })
    } catch (error) {
      relationships.push({ relationshipType, sourceTitle: source.title, targetTitle: target.title, outcome: 'failed', error: errorMessage(error) })
    }
  }

  return { collection, members, relationships }
}

export const knowledgeCollectionPackageImporter: PackageImporter<ValidatedCollectionPackage, ImportKnowledgeCollectionPackageResult> = {
  import: importKnowledgeCollectionPackage,
}
