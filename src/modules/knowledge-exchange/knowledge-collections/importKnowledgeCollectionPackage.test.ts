import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { CollectionMemberEntry } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import type { ValidatedCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import type { ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'

const {
  createKnowledgeCollectionMock,
  addItemToCollectionMock,
  importKnowledgeNodePackageMock,
  importNotePackageMock,
  importAssetPackageMock,
  importDocumentPackageMock,
  importConversationPackageMock,
  importKnowledgeLinkPackageMock,
} = vi.hoisted(() => ({
  createKnowledgeCollectionMock: vi.fn(),
  addItemToCollectionMock: vi.fn(),
  importKnowledgeNodePackageMock: vi.fn(),
  importNotePackageMock: vi.fn(),
  importAssetPackageMock: vi.fn(),
  importDocumentPackageMock: vi.fn(),
  importConversationPackageMock: vi.fn(),
  importKnowledgeLinkPackageMock: vi.fn(),
}))

vi.mock('@/modules/knowledge-intelligence/api/knowledgeCollections', () => ({
  createKnowledgeCollection: createKnowledgeCollectionMock,
  addItemToCollection: addItemToCollectionMock,
}))
vi.mock('@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage', () => ({
  importKnowledgeNodePackage: importKnowledgeNodePackageMock,
}))
vi.mock('@/modules/knowledge-exchange/notes/importNotePackage', () => ({ importNotePackage: importNotePackageMock }))
vi.mock('@/modules/knowledge-exchange/assets/importAssetPackage', () => ({ importAssetPackage: importAssetPackageMock }))
vi.mock('@/modules/knowledge-exchange/documents/importDocumentPackage', () => ({ importDocumentPackage: importDocumentPackageMock }))
vi.mock('@/modules/knowledge-exchange/conversations/importConversationPackage', () => ({
  importConversationPackage: importConversationPackageMock,
}))
vi.mock('@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage', () => ({
  importKnowledgeLinkPackage: importKnowledgeLinkPackageMock,
}))

import { importKnowledgeCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/importKnowledgeCollectionPackage'

function nodeMember(title: string): CollectionMemberEntry {
  return {
    memberType: 'knowledge_node',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      node: { nodeType: 'concept', title, description: null, metadata: null, generationMetadata: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    },
  }
}

function noteMember(title: string): CollectionMemberEntry {
  return {
    memberType: 'note',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      note: { title, content: 'content', tags: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', generationMetadata: null },
    },
  }
}

function assetMember(title: string): CollectionMemberEntry {
  return {
    memberType: 'asset',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      asset: { title, mimeType: 'image/png', width: 10, height: 10, sizeBytes: 5, createdAt: '2026-01-01T00:00:00.000Z', fileDataBase64: 'AAAA' },
    },
  }
}

function documentMember(title: string, archiveEntry: string): CollectionMemberEntry {
  return {
    memberType: 'document',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      document: { title, fileName: `${title}.pdf`, fileType: 'pdf', sizeBytes: 5, createdAt: '2026-01-01T00:00:00.000Z', tags: [] },
    },
    archiveEntry,
  }
}

function conversationMember(title: string): CollectionMemberEntry {
  return {
    memberType: 'conversation',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      conversation: {
        title,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:01.000Z' }],
      },
    },
  }
}

function fakePackage(members: CollectionMemberEntry[], relationships: ValidatedCollectionPackage['manifest']['collection']['relationships'] = []): ValidatedCollectionPackage {
  const documentMembers = new Map<string, ValidatedDocumentPackage>()
  for (const member of members) {
    if (member.memberType === 'document') {
      documentMembers.set(member.archiveEntry, { manifest: member.payload, zip: {} as ValidatedDocumentPackage['zip'] })
    }
  }
  return {
    manifest: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      collection: { name: 'Plant Biology', description: null, members, relationships },
    },
    zip: {} as ValidatedCollectionPackage['zip'],
    documentMembers,
  }
}

const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }

describe('importKnowledgeCollectionPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createKnowledgeCollectionMock.mockResolvedValue({ id: 'new-collection', user_id: 'importer-1', workspace_id: 'importer-workspace', name: 'Plant Biology', description: null, created_at: '2026-03-01T00:00:00.000Z', updated_at: '2026-03-01T00:00:00.000Z' })
    addItemToCollectionMock.mockResolvedValue({})
  })

  it('always creates the collection first, independent of any member resolving', async () => {
    await importKnowledgeCollectionPackage(fakePackage([]), context)
    expect(createKnowledgeCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', name: 'Plant Biology', description: undefined })
  })

  it('imports a knowledge_node member and adds it as a membership link', async () => {
    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'node-1', title: 'Photosynthesis' }, created: true })
    const result = await importKnowledgeCollectionPackage(fakePackage([nodeMember('Photosynthesis')]), context)

    expect(result.members).toEqual([{ memberType: 'knowledge_node', title: 'Photosynthesis', outcome: 'imported', matched: false }])
    expect(addItemToCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', collectionId: 'new-collection', itemType: 'knowledge_node', itemId: 'node-1' })
  })

  it('reports a matched (not created) knowledge_node distinctly from a newly created one', async () => {
    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'existing-node', title: 'Photosynthesis' }, created: false })
    const result = await importKnowledgeCollectionPackage(fakePackage([nodeMember('Photosynthesis')]), context)
    expect(result.members[0]).toMatchObject({ outcome: 'imported', matched: true })
  })

  it('imports note, asset, and document members through their own unmodified importers', async () => {
    importNotePackageMock.mockResolvedValueOnce({ id: 'note-1', title: 'My Note' })
    importAssetPackageMock.mockResolvedValueOnce({ id: 'asset-1', title: 'My Image' })
    importDocumentPackageMock.mockResolvedValueOnce({ id: 'doc-1', title: 'My Doc' })

    const result = await importKnowledgeCollectionPackage(
      fakePackage([noteMember('My Note'), assetMember('My Image'), documentMember('My Doc', 'document-members/0.zip')]),
      context,
    )

    expect(result.members).toEqual([
      { memberType: 'note', title: 'My Note', outcome: 'imported' },
      { memberType: 'asset', title: 'My Image', outcome: 'imported' },
      { memberType: 'document', title: 'My Doc', outcome: 'imported' },
    ])
    expect(addItemToCollectionMock).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'note', itemId: 'note-1' }))
    expect(addItemToCollectionMock).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'asset', itemId: 'asset-1' }))
    expect(addItemToCollectionMock).toHaveBeenCalledWith(expect.objectContaining({ itemType: 'document', itemId: 'doc-1' }))
  })

  it('imports a conversation member through its own unmodified importer and adds it as a membership link', async () => {
    importConversationPackageMock.mockResolvedValueOnce({ id: 'conversation-1', title: 'Old chat' })
    const result = await importKnowledgeCollectionPackage(fakePackage([conversationMember('Old chat')]), context)

    expect(result.members).toEqual([{ memberType: 'conversation', title: 'Old chat', outcome: 'imported' }])
    expect(addItemToCollectionMock).toHaveBeenCalledWith({ userId: 'importer-1', workspaceId: 'importer-workspace', collectionId: 'new-collection', itemType: 'conversation', itemId: 'conversation-1' })
  })

  it('a failing conversation member is reported failed without blocking the rest of the import', async () => {
    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'node-1', title: 'Photosynthesis' }, created: true })
    importConversationPackageMock.mockRejectedValueOnce(new Error('database unavailable'))

    const result = await importKnowledgeCollectionPackage(
      fakePackage([nodeMember('Photosynthesis'), conversationMember('Old chat')]),
      context,
    )

    expect(result.members).toEqual([
      { memberType: 'knowledge_node', title: 'Photosynthesis', outcome: 'imported', matched: false },
      { memberType: 'conversation', title: 'Old chat', outcome: 'failed', error: 'database unavailable' },
    ])
    expect(addItemToCollectionMock).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'conversation' }))
  })

  it('partial success: one member failing never aborts the rest, and no membership link is added for it', async () => {
    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'node-1', title: 'Photosynthesis' }, created: true })
    importNotePackageMock.mockRejectedValueOnce(new Error('database unavailable'))
    importAssetPackageMock.mockResolvedValueOnce({ id: 'asset-1', title: 'My Image' })

    const result = await importKnowledgeCollectionPackage(
      fakePackage([nodeMember('Photosynthesis'), noteMember('My Note'), assetMember('My Image')]),
      context,
    )

    expect(result.members).toEqual([
      { memberType: 'knowledge_node', title: 'Photosynthesis', outcome: 'imported', matched: false },
      { memberType: 'note', title: 'My Note', outcome: 'failed', error: 'database unavailable' },
      { memberType: 'asset', title: 'My Image', outcome: 'imported' },
    ])
    expect(addItemToCollectionMock).toHaveBeenCalledTimes(2)
    expect(addItemToCollectionMock).not.toHaveBeenCalledWith(expect.objectContaining({ itemType: 'note' }))
    // The collection row itself is still returned — no rollback of the whole import.
    expect(result.collection.id).toBe('new-collection')
  })

  it('replays relationships only after every member has been attempted, and reports each independently', async () => {
    importKnowledgeNodePackageMock.mockResolvedValueOnce({ node: { id: 'node-1', title: 'Photosynthesis' }, created: true })
    importKnowledgeLinkPackageMock.mockResolvedValueOnce(undefined)
    const relationship = {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      link: {
        relationshipType: 'requires',
        confidence: 0.9,
        generatedBy: 'ai:detect-relationships',
        source: { nodeType: 'concept' as const, title: 'Photosynthesis', description: null },
        target: { nodeType: 'concept' as const, title: 'Chlorophyll', description: null },
      },
    }

    const result = await importKnowledgeCollectionPackage(fakePackage([nodeMember('Photosynthesis')], [relationship]), context)

    expect(importKnowledgeLinkPackageMock).toHaveBeenCalledWith(relationship, context)
    expect(result.relationships).toEqual([{ relationshipType: 'requires', sourceTitle: 'Photosynthesis', targetTitle: 'Chlorophyll', outcome: 'imported' }])
  })

  it('a failing relationship is reported failed without discarding the rest of the import', async () => {
    importKnowledgeLinkPackageMock.mockRejectedValueOnce(new Error('one endpoint failed to resolve'))
    const relationship = {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      link: {
        relationshipType: 'requires',
        confidence: null,
        generatedBy: null,
        source: { nodeType: 'concept' as const, title: 'A', description: null },
        target: { nodeType: 'concept' as const, title: 'B', description: null },
      },
    }

    const result = await importKnowledgeCollectionPackage(fakePackage([], [relationship]), context)

    expect(result.relationships).toEqual([{ relationshipType: 'requires', sourceTitle: 'A', targetTitle: 'B', outcome: 'failed', error: 'one endpoint failed to resolve' }])
    expect(result.collection.id).toBe('new-collection')
  })
})
