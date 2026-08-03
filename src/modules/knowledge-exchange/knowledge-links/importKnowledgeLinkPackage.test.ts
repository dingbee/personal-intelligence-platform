import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeNode } from '@/shared/types/database'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { resolveCanonicalNodeMock, upsertKnowledgeEdgesMock } = vi.hoisted(() => ({
  resolveCanonicalNodeMock: vi.fn(),
  upsertKnowledgeEdgesMock: vi.fn(),
}))

vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodeResolution', () => ({
  resolveCanonicalNode: resolveCanonicalNodeMock,
}))
vi.mock('@/modules/knowledge-intelligence/api/knowledgeEdges', () => ({
  upsertKnowledgeEdges: upsertKnowledgeEdgesMock,
}))

import { importKnowledgeLinkPackage, knowledgeLinkPackageImporter } from '@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage'
import { KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-x',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: null,
    source_type: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
    source_id: 'random-uuid',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakePackage(overrides: Partial<KnowledgeLinkPackage['link']> = {}): KnowledgeLinkPackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    link: {
      relationshipType: 'requires',
      confidence: 0.82,
      generatedBy: 'ai:detect-relationships',
      source: { nodeType: 'concept', title: 'Photosynthesis', description: 'Converts light to energy.' },
      target: { nodeType: 'concept', title: 'Chlorophyll', description: 'Absorbs light.' },
      ...overrides,
    },
  }
}

describe('importKnowledgeLinkPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves both endpoints through resolveCanonicalNode with the importer as owner and the chosen workspace', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node', title: 'Photosynthesis' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node', title: 'Chlorophyll' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Photosynthesis', nodeType: 'concept' }),
    )
    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Chlorophyll', nodeType: 'concept' }),
    )
  })

  it('uses the distinct knowledge-node-import source type and a fresh sourceId for each endpoint, never the exporter identity', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const [sourceCall, targetCall] = resolveCanonicalNodeMock.mock.calls
    expect(sourceCall![0].sourceType).toBe(KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE)
    expect(targetCall![0].sourceType).toBe(KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE)
    expect(typeof sourceCall![0].sourceId).toBe('string')
    expect(sourceCall![0].sourceId).not.toBe(targetCall![0].sourceId)
  })

  it('creates the relationship only after both endpoints resolve, using their real (possibly reused) node ids', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: false })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(upsertKnowledgeEdgesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceType: 'knowledge_node',
        sourceId: 'source-node',
        targetType: 'knowledge_node',
        targetId: 'target-node',
        relationshipType: 'requires',
        confidence: 0.82,
        generatedBy: 'ai:detect-relationships',
      }),
    ])
  })

  it('records importedFrom provenance in the edge metadata', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = upsertKnowledgeEdgesMock.mock.calls[0]![0][0] as { metadata: { importedFrom: Record<string, unknown> } }
    expect(call.metadata.importedFrom).toMatchObject({
      packageVersion: CURRENT_PACKAGE_VERSION,
      sourceVersion: PACKAGE_SOURCE_VERSION,
      exportedAt: '2026-01-05T00:00:00.000Z',
    })
  })

  it('falls back to a distinct generatedBy label only when the package genuinely has none', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage({ generatedBy: null }), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(upsertKnowledgeEdgesMock).toHaveBeenCalledWith([expect.objectContaining({ generatedBy: 'knowledge_link_import' })])
  })

  it('never overwrites source_type/source_id/generatedBy with anything from the exporter account', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(resolveCanonicalNodeMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ userId: 'exporter-1' })]),
    )
  })

  it('supports importing into no workspace (personal)', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node', workspace_id: null }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node', workspace_id: null }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: null })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: null }))
    expect(upsertKnowledgeEdgesMock).toHaveBeenCalledWith([expect.objectContaining({ workspaceId: null })])
  })

  it('returns both nodes and their created flags', async () => {
    const sourceNode = fakeNode({ id: 'source-node', title: 'Photosynthesis' })
    const targetNode = fakeNode({ id: 'target-node', title: 'Chlorophyll' })
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: sourceNode, created: true }).mockResolvedValueOnce({ node: targetNode, created: false })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toEqual({
      sourceNode,
      targetNode,
      sourceCreated: true,
      targetCreated: false,
      relationshipType: 'requires',
    })
  })

  it('never creates the relationship if resolving the source endpoint fails', async () => {
    resolveCanonicalNodeMock.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(
      importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' }),
    ).rejects.toThrow('database unavailable')

    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalled()
  })

  it('never creates the relationship if resolving the target endpoint fails', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockRejectedValueOnce(new Error('database unavailable'))

    await expect(
      importKnowledgeLinkPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' }),
    ).rejects.toThrow('database unavailable')

    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalled()
  })

  it('the knowledgeLinkPackageImporter object delegates to the same function', async () => {
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeNode({ id: 'source-node' }), created: true })
      .mockResolvedValueOnce({ node: fakeNode({ id: 'target-node' }), created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    const result = await knowledgeLinkPackageImporter.import(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.relationshipType).toBe('requires')
  })
})
