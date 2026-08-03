import { getNote } from '@/modules/notes/api/notes'
import { listTagsForNote } from '@/modules/notes/api/noteTags'
import { getConversation } from '@/modules/ai/chat/api/conversations'
import { listMessages } from '@/modules/ai/chat/api/messages'
import { getKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { getDocumentWithTags } from '@/modules/library/api/documents'
import { getExtractionMetadata } from '@/modules/processing/api/extractionMetadata'
import { getAsset } from '@/modules/assets/api/assets'
import { getKnowledgeCollection, listCollectionItems } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { exportNotePackage } from '@/modules/knowledge-exchange/notes/exportNotePackage'
import { exportConversationPackage } from '@/modules/knowledge-exchange/conversations/exportConversationPackage'
import { exportKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { exportAssetPackage } from '@/modules/knowledge-exchange/assets/exportAssetPackage'
import { fetchAssetOriginalAsBase64 } from '@/modules/knowledge-exchange/assets/assetFileTransfer'
import { buildKnowledgeCollectionExportPackage } from '@/modules/knowledge-exchange/knowledge-collections/buildKnowledgeCollectionExportPackage'
import { buildNoteExportContent } from '@/modules/export/content/noteExportContent'
import { buildConversationExportContent } from '@/modules/export/content/conversationExportContent'
import { buildKnowledgeNodeExportContent } from '@/modules/export/content/knowledgeNodeExportContent'
import { buildDocumentExportContent } from '@/modules/export/content/documentExportContent'
import { buildAssetExportContent } from '@/modules/export/content/assetExportContent'
import { buildCollectionExportContent } from '@/modules/export/content/collectionExportContent'
import { exportFilename } from '@/modules/export/types'
import type { ExportRequest } from '@/modules/export/exportService'

export type ExportableObjectType = 'note' | 'conversation' | 'knowledge_node' | 'document' | 'asset' | 'knowledge_collection'

export interface ExportableObjectRef {
  type: ExportableObjectType
  id: string
  title: string
}

/**
 * UX-15.1 — the Export Center's one dispatch point: given an object's type
 * and id (already known from that type's own existing list hook — Notes/
 * Conversations/Knowledge Nodes/Documents/Assets/Collections), fetches
 * exactly what that object's own detail page already fetches before
 * opening `KnowledgeExportDialog`, and builds the identical `ExportRequest`
 * that page's own inline `request={{ ... }}` prop already builds. This
 * function does no new serialization of its own — it only orchestrates
 * (fetch, then call each type's already-existing, unmodified content
 * adapter + `export<Type>Package`/`buildKnowledgeCollectionExportPackage`
 * function), the same "UI only orchestrates" discipline `exportService.ts`
 * itself follows.
 */
export async function buildExportRequestForObject(ref: ExportableObjectRef): Promise<ExportRequest> {
  switch (ref.type) {
    case 'note': {
      const [note, tags] = await Promise.all([getNote(ref.id), listTagsForNote(ref.id)])
      return {
        content: buildNoteExportContent(note, tags),
        titleForFilename: note.title,
        buildNovaPackage: async () => ({
          filename: exportFilename(note.title, 'nova'),
          blob: new Blob([JSON.stringify(exportNotePackage(note, tags), null, 2)], { type: 'application/json' }),
        }),
      }
    }
    case 'conversation': {
      const [conversation, messages] = await Promise.all([getConversation(ref.id), listMessages(ref.id)])
      return {
        content: buildConversationExportContent(conversation, messages),
        titleForFilename: conversation.title,
        buildNovaPackage: async () => ({
          filename: exportFilename(conversation.title, 'nova'),
          blob: new Blob([JSON.stringify(exportConversationPackage({ conversation, messages }), null, 2)], { type: 'application/json' }),
        }),
      }
    }
    case 'knowledge_node': {
      const evidence = await getKnowledgeNodeEvidence(ref.id)
      return {
        content: buildKnowledgeNodeExportContent(evidence),
        titleForFilename: evidence.node.title,
        buildNovaPackage: async () => ({
          filename: exportFilename(evidence.node.title, 'nova'),
          blob: new Blob([JSON.stringify(exportKnowledgeNodePackage(evidence.node), null, 2)], { type: 'application/json' }),
        }),
      }
    }
    case 'document': {
      const [document, metadata] = await Promise.all([getDocumentWithTags(ref.id), getExtractionMetadata(ref.id)])
      return {
        content: buildDocumentExportContent(document, metadata),
        titleForFilename: document.title,
        buildNovaPackage: async () => {
          const originalFile = await fetchDocumentOriginalFile(document)
          const manifest = exportDocumentPackage({ document, tags: document.tags })
          const zipBlob = await buildDocumentPackageZip(manifest, originalFile)
          return { filename: exportFilename(document.title, 'nova'), blob: zipBlob }
        },
      }
    }
    case 'asset': {
      const asset = await getAsset(ref.id)
      return {
        content: buildAssetExportContent(asset),
        titleForFilename: asset.title,
        buildNovaPackage: async () => {
          const fileDataBase64 = await fetchAssetOriginalAsBase64(asset)
          const pkg = exportAssetPackage({ asset, fileDataBase64 })
          return {
            filename: exportFilename(asset.title, 'nova'),
            blob: new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }),
          }
        },
      }
    }
    case 'knowledge_collection': {
      const [collection, items] = await Promise.all([getKnowledgeCollection(ref.id), listCollectionItems(ref.id)])
      return {
        content: buildCollectionExportContent(collection, items),
        titleForFilename: collection.name,
        buildNovaPackage: async () => {
          const { zipBlob } = await buildKnowledgeCollectionExportPackage(ref.id)
          return { filename: exportFilename(collection.name, 'nova'), blob: zipBlob }
        },
      }
    }
  }
}
