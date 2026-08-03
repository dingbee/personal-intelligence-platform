import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { getKnowledgeCollection, type CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { getNote } from '@/modules/notes/api/notes'
import { listTagsForNote } from '@/modules/notes/api/noteTags'
import { getAsset } from '@/modules/assets/api/assets'
import { getDocumentWithTags } from '@/modules/library/api/documents'
import { getConversation } from '@/modules/ai/chat/api/conversations'
import { listMessages } from '@/modules/ai/chat/api/messages'
import { exportKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { exportNotePackage } from '@/modules/knowledge-exchange/notes/exportNotePackage'
import { exportAssetPackage } from '@/modules/knowledge-exchange/assets/exportAssetPackage'
import { fetchAssetOriginalAsBase64 } from '@/modules/knowledge-exchange/assets/assetFileTransfer'
import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { exportConversationPackage } from '@/modules/knowledge-exchange/conversations/exportConversationPackage'
import { exportKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/exportKnowledgeLinkPackage'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import {
  fetchCollectionMembershipLinks,
  fetchKnowledgeNodeById,
  fetchRelationshipsAmongNodes,
} from '@/modules/knowledge-exchange/knowledge-collections/collectionMemberFetch'
import { buildCollectionPackageZip, documentMemberArchiveEntry } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageArchive'
import {
  exportKnowledgeCollectionPackage,
} from '@/modules/knowledge-exchange/knowledge-collections/exportKnowledgeCollectionPackage'
import type { CollectionMemberEntry, CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'

function membershipKey(itemType: CollectionItemType, itemId: string): string {
  return `${itemType}:${itemId}`
}

/**
 * UX-14.5.10.6 — the top-level async orchestration the Export button calls:
 * fetch the collection, its membership, every member's own full row (and,
 * for Assets/Documents, their binary content), dispatch each to that
 * type's own existing, unmodified `export<Type>Package` function, then
 * assemble everything into one package via the (pure) manifest builder and
 * the (zip-building) archive builder. Per the discovery's §4, this
 * function does no per-type serialization of its own — only fetching and
 * dispatch. Sequential, not `Promise.all`'d, across binary members
 * (Assets/Documents) deliberately: keeps peak memory bounded to roughly one
 * member's own file at a time, which matters once a collection's total
 * size can realistically reach the "hundreds of MB to low GB" range the
 * discovery's §4 flags.
 */
export async function buildKnowledgeCollectionExportPackage(
  collectionId: string,
): Promise<{ manifest: CollectionPackageManifest; zipBlob: Blob }> {
  const collection = await getKnowledgeCollection(collectionId)
  const links = await fetchCollectionMembershipLinks(collectionId)

  const idsByType = new Map<CollectionItemType, string[]>()
  const addedAtByMember = new Map<string, string>()
  for (const link of links) {
    const list = idsByType.get(link.itemType) ?? []
    list.push(link.itemId)
    idsByType.set(link.itemType, list)
    addedAtByMember.set(membershipKey(link.itemType, link.itemId), link.createdAt)
  }

  const members: CollectionMemberEntry[] = []
  const documentMemberZips: Blob[] = []

  const nodeIds = idsByType.get('knowledge_node') ?? []
  const nodesById = new Map<string, KnowledgeNode>()
  for (const id of nodeIds) {
    const node = await fetchKnowledgeNodeById(id)
    nodesById.set(id, node)
    members.push({
      memberType: 'knowledge_node',
      originalAddedAt: addedAtByMember.get(membershipKey('knowledge_node', id))!,
      payload: exportKnowledgeNodePackage(node),
    })
  }

  for (const id of idsByType.get('note') ?? []) {
    const note = await getNote(id)
    const tags = await listTagsForNote(id)
    members.push({
      memberType: 'note',
      originalAddedAt: addedAtByMember.get(membershipKey('note', id))!,
      payload: exportNotePackage(note, tags),
    })
  }

  for (const id of idsByType.get('asset') ?? []) {
    const asset = await getAsset(id)
    const fileDataBase64 = await fetchAssetOriginalAsBase64(asset)
    members.push({
      memberType: 'asset',
      originalAddedAt: addedAtByMember.get(membershipKey('asset', id))!,
      payload: exportAssetPackage({ asset, fileDataBase64 }),
    })
  }

  for (const id of idsByType.get('document') ?? []) {
    const document = await getDocumentWithTags(id)
    const originalFile = await fetchDocumentOriginalFile(document)
    const documentManifest = exportDocumentPackage({ document, tags: document.tags })
    const memberZip = await buildDocumentPackageZip(documentManifest, originalFile)
    const archiveEntry = documentMemberArchiveEntry(documentMemberZips.length)
    documentMemberZips.push(memberZip)
    members.push({
      memberType: 'document',
      originalAddedAt: addedAtByMember.get(membershipKey('document', id))!,
      payload: documentManifest,
      archiveEntry,
    })
  }

  for (const id of idsByType.get('conversation') ?? []) {
    const conversation = await getConversation(id)
    const messages = await listMessages(id)
    members.push({
      memberType: 'conversation',
      originalAddedAt: addedAtByMember.get(membershipKey('conversation', id))!,
      payload: exportConversationPackage({ conversation, messages }),
    })
  }

  const relationshipLinks: KnowledgeLink[] = await fetchRelationshipsAmongNodes(nodeIds)
  const relationships: KnowledgeLinkPackage[] = relationshipLinks.map((link) =>
    exportKnowledgeLinkPackage({
      link,
      sourceNode: nodesById.get(link.source_id)!,
      targetNode: nodesById.get(link.target_id)!,
    }),
  )

  const manifest = exportKnowledgeCollectionPackage({
    collection: { name: collection.name, description: collection.description },
    members,
    relationships,
  })
  const zipBlob = await buildCollectionPackageZip(manifest, documentMemberZips)
  return { manifest, zipBlob }
}
