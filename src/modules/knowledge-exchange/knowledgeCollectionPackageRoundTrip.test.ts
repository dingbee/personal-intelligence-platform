import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, KnowledgeNode, Message } from '@/shared/types/database'

/**
 * UX-14.5.10.6 / UX-14.5.12 integration tests: export a collection (a
 * knowledge_node member, a document member with a real nested archive,
 * and a conversation member, plus a relationship between concepts),
 * build the real `.zip` container, simulate the file round trip,
 * validate it, and import it into a different account — proving the
 * full chain: export -> transfer -> import -> membership restored ->
 * duplicates reused -> partial failures reported. Per-type importers are
 * mocked (each has its own dedicated test file already); this file's job
 * is proving the whole Collection-specific pipeline
 * (types/archive/export/validate/import) fits together end to end, the
 * same role
 * `documentPackageRoundTrip.test.ts`/`knowledgeLinkPackageRoundTrip.test.ts`
 * already play for their own package types.
 */

const {
  downloadDocumentFileMock,
  createKnowledgeCollectionMock,
  addItemToCollectionMock,
  importKnowledgeNodePackageMock,
  importDocumentPackageMock,
  importConversationPackageMock,
  importKnowledgeLinkPackageMock,
} = vi.hoisted(() => ({
  downloadDocumentFileMock: vi.fn(),
  createKnowledgeCollectionMock: vi.fn(),
  addItemToCollectionMock: vi.fn(),
  importKnowledgeNodePackageMock: vi.fn(),
  importDocumentPackageMock: vi.fn(),
  importConversationPackageMock: vi.fn(),
  importKnowledgeLinkPackageMock: vi.fn(),
}))

vi.mock('@/modules/processing/pipeline/downloadFile', () => ({ downloadDocumentFile: downloadDocumentFileMock }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeCollections', () => ({
  createKnowledgeCollection: createKnowledgeCollectionMock,
  addItemToCollection: addItemToCollectionMock,
}))
vi.mock('@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage', () => ({
  importKnowledgeNodePackage: importKnowledgeNodePackageMock,
}))
vi.mock('@/modules/knowledge-exchange/documents/importDocumentPackage', () => ({
  importDocumentPackage: importDocumentPackageMock,
}))
vi.mock('@/modules/knowledge-exchange/conversations/importConversationPackage', () => ({
  importConversationPackage: importConversationPackageMock,
}))
vi.mock('@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage', () => ({
  importKnowledgeLinkPackage: importKnowledgeLinkPackageMock,
}))

import { exportKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { exportConversationPackage } from '@/modules/knowledge-exchange/conversations/exportConversationPackage'
import { exportKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/exportKnowledgeLinkPackage'
import { exportKnowledgeCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/exportKnowledgeCollectionPackage'
import { buildCollectionPackageZip, documentMemberArchiveEntry } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageArchive'
import { parseKnowledgeCollectionPackageZip } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import { importKnowledgeCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/importKnowledgeCollectionPackage'
import type { CollectionMemberEntry } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'source-node-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'How plants make food.',
    source_type: 'document',
    source_id: 'exporter-document-1',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeChlorophyllNode(): KnowledgeNode {
  return fakeNode({ id: 'source-node-2', title: 'Chlorophyll', title_normalized: 'chlorophyll', description: 'The green pigment.' })
}

async function buildSourcePackage() {
  const sourceNode = fakeNode()
  const targetNode = fakeChlorophyllNode()

  const nodeMember: CollectionMemberEntry = {
    memberType: 'knowledge_node',
    originalAddedAt: '2026-01-02T00:00:00.000Z',
    payload: exportKnowledgeNodePackage(sourceNode),
  }

  downloadDocumentFileMock.mockResolvedValueOnce(new Blob(['the original document bytes']))
  const documentManifest = exportDocumentPackage({
    document: {
      id: 'source-doc-1',
      user_id: 'exporter-1',
      workspace_id: 'exporter-workspace',
      collection_id: null,
      title: 'Field Notes',
      file_name: 'field-notes.pdf',
      file_path: 'exporter-1/source-doc-1-field-notes.pdf',
      file_type: 'pdf',
      file_size: 28,
      status: 'ready',
      source: 'upload',
      source_file_id: null,
      source_metadata: {},
      imported_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    tags: [],
  })
  const originalFile = await fetchDocumentOriginalFile({ file_path: 'exporter-1/source-doc-1-field-notes.pdf' })
  const nestedDocumentZip = await buildDocumentPackageZip(documentManifest, originalFile)
  const documentMember: CollectionMemberEntry = {
    memberType: 'document',
    originalAddedAt: '2026-01-03T00:00:00.000Z',
    payload: documentManifest,
    archiveEntry: documentMemberArchiveEntry(0),
  }

  const sourceConversation: Conversation = {
    id: 'source-conversation-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    document_id: null,
    title: 'A chat about plants',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: false,
    favorite: false,
    color: null,
    icon: null,
    created_at: '2026-01-04T00:00:00.000Z',
    updated_at: '2026-01-04T00:01:00.000Z',
  }
  const sourceMessages: Message[] = [
    {
      id: 'source-message-1',
      conversation_id: 'source-conversation-1',
      user_id: 'exporter-1',
      role: 'user',
      content: 'What should I plant near the river?',
      context_chunk_ids: [],
      created_at: '2026-01-04T00:00:00.000Z',
    },
    {
      id: 'source-message-2',
      conversation_id: 'source-conversation-1',
      user_id: 'exporter-1',
      role: 'assistant',
      content: 'Reeds and papyrus do well in riverside conditions.',
      context_chunk_ids: [],
      created_at: '2026-01-04T00:01:00.000Z',
    },
  ]
  const conversationMember: CollectionMemberEntry = {
    memberType: 'conversation',
    originalAddedAt: '2026-01-04T00:00:00.000Z',
    payload: exportConversationPackage({ conversation: sourceConversation, messages: sourceMessages }),
  }

  const relationship = exportKnowledgeLinkPackage({
    link: {
      id: 'link-1',
      user_id: 'exporter-1',
      workspace_id: 'exporter-workspace',
      source_type: 'knowledge_node',
      source_id: sourceNode.id,
      target_type: 'knowledge_node',
      target_id: targetNode.id,
      created_at: '2026-01-01T00:00:00.000Z',
      relationship_type: 'requires',
      confidence: 0.9,
      generated_by: 'ai:detect-relationships',
      metadata: null,
    },
    sourceNode,
    targetNode,
  })

  const manifest = exportKnowledgeCollectionPackage({
    collection: { name: 'Plant Biology', description: 'Curated concepts, notes, and documents about plants.' },
    members: [nodeMember, documentMember, conversationMember],
    relationships: [relationship],
  })
  const zipBlob = await buildCollectionPackageZip(manifest, [nestedDocumentZip])
  return { manifest, zipBlob }
}

const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }

describe('Knowledge Collection export -> transfer -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createKnowledgeCollectionMock.mockResolvedValue({
      id: 'new-collection',
      user_id: 'importer-1',
      workspace_id: 'importer-workspace',
      name: 'Plant Biology',
      description: 'Curated concepts, notes, and documents about plants.',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    })
    addItemToCollectionMock.mockResolvedValue({})
  })

  it('validates cleanly after a full export -> zip -> transfer round trip, carrying no exporter identity', async () => {
    const { manifest, zipBlob } = await buildSourcePackage()

    // Simulate the file round trip: serialize to raw bytes, as if downloaded and re-selected in a file picker.
    const reopened = new Blob([await zipBlob.arrayBuffer()])
    const parsed = await parseKnowledgeCollectionPackageZip(reopened)

    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return
    expect(parsed.package.manifest).toEqual(manifest)
    expect(parsed.package.documentMembers.size).toBe(1)

    const serialized = JSON.stringify(parsed.package.manifest)
    expect(serialized).not.toContain('exporter-1')
    expect(serialized).not.toContain('exporter-workspace')
    expect(serialized).not.toContain('source-node-1')
    expect(serialized).not.toContain('source-doc-1')
  })

  it('imports every member, restores membership for every successfully-resolved member including the conversation, and replays the relationship', async () => {
    const { zipBlob } = await buildSourcePackage()
    const parsed = await parseKnowledgeCollectionPackageZip(new Blob([await zipBlob.arrayBuffer()]))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'imported-node-1', title: 'Photosynthesis' }, created: true })
    importDocumentPackageMock.mockResolvedValueOnce({ id: 'imported-doc-1', title: 'Field Notes' })
    importConversationPackageMock.mockResolvedValueOnce({ id: 'imported-conversation-1', title: 'A chat about plants' })
    importKnowledgeLinkPackageMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeCollectionPackage(parsed.package, context)

    expect(createKnowledgeCollectionMock).toHaveBeenCalledWith({
      userId: 'importer-1',
      workspaceId: 'importer-workspace',
      name: 'Plant Biology',
      description: 'Curated concepts, notes, and documents about plants.',
    })

    expect(result.members).toEqual([
      { memberType: 'knowledge_node', title: 'Photosynthesis', outcome: 'imported', matched: false },
      { memberType: 'document', title: 'Field Notes', outcome: 'imported' },
      { memberType: 'conversation', title: 'A chat about plants', outcome: 'imported' },
    ])
    expect(addItemToCollectionMock).toHaveBeenCalledTimes(3)
    expect(addItemToCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', collectionId: 'new-collection', itemType: 'knowledge_node', itemId: 'imported-node-1' })
    expect(addItemToCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', collectionId: 'new-collection', itemType: 'document', itemId: 'imported-doc-1' })
    expect(addItemToCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', collectionId: 'new-collection', itemType: 'conversation', itemId: 'imported-conversation-1' })

    expect(result.relationships).toEqual([{ relationshipType: 'requires', sourceTitle: 'Photosynthesis', targetTitle: 'Chlorophyll', outcome: 'imported' }])
  })

  it('re-importing the same package a second time reuses the matched knowledge_node instead of duplicating it', async () => {
    const { zipBlob } = await buildSourcePackage()
    const parsed = await parseKnowledgeCollectionPackageZip(new Blob([await zipBlob.arrayBuffer()]))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'existing-node-1', title: 'Photosynthesis' }, created: false })
    importDocumentPackageMock.mockResolvedValueOnce({ id: 'imported-doc-2', title: 'Field Notes' })
    importConversationPackageMock.mockResolvedValueOnce({ id: 'imported-conversation-2', title: 'A chat about plants' })
    importKnowledgeLinkPackageMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeCollectionPackage(parsed.package, context)

    expect(result.members[0]).toMatchObject({ memberType: 'knowledge_node', outcome: 'imported', matched: true })
    // The collection itself is always created fresh — a second import produces a second collection row, not a merge.
    expect(createKnowledgeCollectionMock).toHaveBeenCalledTimes(1)
  })

  it('a failing document member is reported failed without discarding the already-successful knowledge_node member or the collection itself', async () => {
    const { zipBlob } = await buildSourcePackage()
    const parsed = await parseKnowledgeCollectionPackageZip(new Blob([await zipBlob.arrayBuffer()]))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'imported-node-1', title: 'Photosynthesis' }, created: true })
    importDocumentPackageMock.mockRejectedValueOnce(new Error('storage upload failed'))
    importConversationPackageMock.mockResolvedValueOnce({ id: 'imported-conversation-1', title: 'A chat about plants' })
    importKnowledgeLinkPackageMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeCollectionPackage(parsed.package, context)

    expect(result.collection.id).toBe('new-collection')
    expect(result.members).toEqual([
      { memberType: 'knowledge_node', title: 'Photosynthesis', outcome: 'imported', matched: false },
      { memberType: 'document', title: 'Field Notes', outcome: 'failed', error: 'storage upload failed' },
      { memberType: 'conversation', title: 'A chat about plants', outcome: 'imported' },
    ])
    expect(addItemToCollectionMock).toHaveBeenCalledTimes(2)
    expect(addItemToCollectionMock).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'document' }))
    // The relationship still replays — it only depends on the knowledge_node member, which succeeded.
    expect(result.relationships[0]).toMatchObject({ outcome: 'imported' })
  })

  it('rejects a hand-tampered package (unsupported version) before any member is imported', async () => {
    const { zipBlob } = await buildSourcePackage()
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())
    // Corrupt is too strong a word here — this simulates a *structurally valid* zip whose manifest.json was hand-edited,
    // which parseKnowledgeCollectionPackageZip must still catch via the version check, not just the CRC check.
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBytes)
    const manifestText = await zip.file('manifest.json')!.async('text')
    const tampered = { ...JSON.parse(manifestText), version: 999 }
    zip.file('manifest.json', JSON.stringify(tampered))
    const tamperedBlob = await zip.generateAsync({ type: 'blob' })

    const parsed = await parseKnowledgeCollectionPackageZip(tamperedBlob)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues.some((i) => i.code === 'future_version')).toBe(true)
    expect(createKnowledgeCollectionMock).not.toHaveBeenCalled()
    expect(importKnowledgeNodePackageMock).not.toHaveBeenCalled()
    expect(importDocumentPackageMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download before any member is imported', async () => {
    const { zipBlob } = await buildSourcePackage()
    const truncatedBytes = (await zipBlob.arrayBuffer()).slice(0, -20)

    const parsed = await parseKnowledgeCollectionPackageZip(new Blob([truncatedBytes]))

    expect(parsed.valid).toBe(false)
    expect(createKnowledgeCollectionMock).not.toHaveBeenCalled()
  })
})
