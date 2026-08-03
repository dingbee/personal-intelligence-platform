import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getNoteMock,
  listTagsForNoteMock,
  getConversationMock,
  listMessagesMock,
  getKnowledgeNodeEvidenceMock,
  getDocumentWithTagsMock,
  getExtractionMetadataMock,
  fetchDocumentOriginalFileMock,
  getAssetMock,
  fetchAssetOriginalAsBase64Mock,
  getKnowledgeCollectionMock,
  listCollectionItemsMock,
  buildKnowledgeCollectionExportPackageMock,
} = vi.hoisted(() => ({
  getNoteMock: vi.fn(),
  listTagsForNoteMock: vi.fn(),
  getConversationMock: vi.fn(),
  listMessagesMock: vi.fn(),
  getKnowledgeNodeEvidenceMock: vi.fn(),
  getDocumentWithTagsMock: vi.fn(),
  getExtractionMetadataMock: vi.fn(),
  fetchDocumentOriginalFileMock: vi.fn(),
  getAssetMock: vi.fn(),
  fetchAssetOriginalAsBase64Mock: vi.fn(),
  getKnowledgeCollectionMock: vi.fn(),
  listCollectionItemsMock: vi.fn(),
  buildKnowledgeCollectionExportPackageMock: vi.fn(),
}))

vi.mock('@/modules/notes/api/notes', () => ({ getNote: getNoteMock }))
vi.mock('@/modules/notes/api/noteTags', () => ({ listTagsForNote: listTagsForNoteMock }))
vi.mock('@/modules/ai/chat/api/conversations', () => ({ getConversation: getConversationMock }))
vi.mock('@/modules/ai/chat/api/messages', () => ({ listMessages: listMessagesMock }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodeEvidence', () => ({ getKnowledgeNodeEvidence: getKnowledgeNodeEvidenceMock }))
vi.mock('@/modules/library/api/documents', () => ({ getDocumentWithTags: getDocumentWithTagsMock }))
vi.mock('@/modules/processing/api/extractionMetadata', () => ({ getExtractionMetadata: getExtractionMetadataMock }))
vi.mock('@/modules/knowledge-exchange/documents/documentPackageArchive', () => ({
  buildDocumentPackageZip: vi.fn().mockResolvedValue(new Blob(['zip'])),
  fetchDocumentOriginalFile: fetchDocumentOriginalFileMock,
}))
vi.mock('@/modules/assets/api/assets', () => ({ getAsset: getAssetMock }))
vi.mock('@/modules/knowledge-exchange/assets/assetFileTransfer', () => ({ fetchAssetOriginalAsBase64: fetchAssetOriginalAsBase64Mock }))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeCollections', () => ({
  getKnowledgeCollection: getKnowledgeCollectionMock,
  listCollectionItems: listCollectionItemsMock,
}))
vi.mock('@/modules/knowledge-exchange/knowledge-collections/buildKnowledgeCollectionExportPackage', () => ({
  buildKnowledgeCollectionExportPackage: buildKnowledgeCollectionExportPackageMock,
}))

import { buildExportRequestForObject } from '@/modules/export/exportCenterRequests'

describe('buildExportRequestForObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches a note ref to getNote/listTagsForNote and builds a note request', async () => {
    getNoteMock.mockResolvedValue({ id: 'note-1', title: 'My Note', content: 'Body', source_chunk_ids: null })
    listTagsForNoteMock.mockResolvedValue([])

    const request = await buildExportRequestForObject({ type: 'note', id: 'note-1', title: 'My Note' })

    expect(request.content.title).toBe('My Note')
    expect(request.titleForFilename).toBe('My Note')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('my-note.nova')
  })

  it('dispatches a conversation ref to getConversation/listMessages', async () => {
    getConversationMock.mockResolvedValue({ id: 'conversation-1', title: 'A chat', document_id: null })
    listMessagesMock.mockResolvedValue([{ id: 'm1', role: 'user', content: 'Hi', created_at: '2026-01-01T00:00:00.000Z' }])

    const request = await buildExportRequestForObject({ type: 'conversation', id: 'conversation-1', title: 'A chat' })

    expect(request.content.title).toBe('A chat')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('a-chat.nova')
  })

  it('dispatches a knowledge_node ref to getKnowledgeNodeEvidence', async () => {
    getKnowledgeNodeEvidenceMock.mockResolvedValue({
      node: { id: 'node-1', title: 'Photosynthesis', node_type: 'concept', description: null },
      evidence: [],
      relatedNodes: [],
      confidence: 0.5,
    })

    const request = await buildExportRequestForObject({ type: 'knowledge_node', id: 'node-1', title: 'Photosynthesis' })

    expect(request.content.title).toBe('Photosynthesis')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('photosynthesis.nova')
  })

  it('dispatches a document ref to getDocumentWithTags/getExtractionMetadata', async () => {
    getDocumentWithTagsMock.mockResolvedValue({
      id: 'document-1',
      title: 'Field Notes',
      file_type: 'pdf',
      file_size: 1024,
      tags: [],
    })
    getExtractionMetadataMock.mockResolvedValue(null)
    fetchDocumentOriginalFileMock.mockResolvedValue(new Blob(['bytes']))

    const request = await buildExportRequestForObject({ type: 'document', id: 'document-1', title: 'Field Notes' })

    expect(request.content.title).toBe('Field Notes')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('field-notes.nova')
  })

  it('dispatches an asset ref to getAsset', async () => {
    getAssetMock.mockResolvedValue({
      id: 'asset-1',
      title: 'Riverbank Photo',
      mime_type: 'image/jpeg',
      width: 100,
      height: 100,
      size_bytes: 1000,
      created_at: '2026-01-01T00:00:00.000Z',
    })
    fetchAssetOriginalAsBase64Mock.mockResolvedValue('base64data')

    const request = await buildExportRequestForObject({ type: 'asset', id: 'asset-1', title: 'Riverbank Photo' })

    expect(request.content.title).toBe('Riverbank Photo')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('riverbank-photo.nova')
  })

  it('dispatches a knowledge_collection ref to getKnowledgeCollection/listCollectionItems', async () => {
    getKnowledgeCollectionMock.mockResolvedValue({ id: 'collection-1', name: 'Plant Biology', description: null })
    listCollectionItemsMock.mockResolvedValue([])
    buildKnowledgeCollectionExportPackageMock.mockResolvedValue({ manifest: {}, zipBlob: new Blob(['zip']) })

    const request = await buildExportRequestForObject({ type: 'knowledge_collection', id: 'collection-1', title: 'Plant Biology' })

    expect(request.content.title).toBe('Plant Biology')
    const nova = await request.buildNovaPackage()
    expect(nova.filename).toBe('plant-biology.nova')
    expect(buildKnowledgeCollectionExportPackageMock).toHaveBeenCalledWith('collection-1')
  })
})
