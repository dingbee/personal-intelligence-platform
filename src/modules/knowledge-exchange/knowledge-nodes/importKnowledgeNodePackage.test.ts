import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeNode } from '@/shared/types/database'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { resolveCanonicalNodeMock } = vi.hoisted(() => ({ resolveCanonicalNodeMock: vi.fn() }))

vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodeResolution', () => ({
  resolveCanonicalNode: resolveCanonicalNodeMock,
}))

import {
  importKnowledgeNodePackage,
  knowledgeNodePackageImporter,
  KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
} from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-new',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'The process plants use to convert light into chemical energy.',
    source_type: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
    source_id: 'random-uuid-1',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakePackage(overrides: Partial<KnowledgeNodePackage['node']> = {}): KnowledgeNodePackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    node: {
      nodeType: 'concept',
      title: 'Photosynthesis',
      description: 'The process plants use to convert light into chemical energy.',
      metadata: { entityType: null },
      generationMetadata: { capability: 'extract-knowledge' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      ...overrides,
    },
  }
}

describe('importKnowledgeNodePackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the node through resolveCanonicalNode with the importer as owner and the chosen workspace', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'importer-1',
        workspaceId: 'importer-workspace',
        nodeType: 'concept',
        title: 'Photosynthesis',
        description: 'The process plants use to convert light into chemical energy.',
      }),
    )
  })

  it('supports importing into no workspace (personal)', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode({ workspace_id: null }), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: null })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: null }))
  })

  it('uses a distinct, honest source type — never a document/note/conversation the importer does not have', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(expect.objectContaining({ sourceType: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE }))
  })

  it('generates a fresh sourceId per call rather than reusing anything from the package', async () => {
    resolveCanonicalNodeMock.mockResolvedValue({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })
    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const firstCallSourceId = resolveCanonicalNodeMock.mock.calls[0]![0].sourceId
    const secondCallSourceId = resolveCanonicalNodeMock.mock.calls[1]![0].sourceId
    expect(typeof firstCallSourceId).toBe('string')
    expect(firstCallSourceId).not.toBe(secondCallSourceId)
  })

  it('clears source_chunk_ids — meaningless cross-account', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(expect.objectContaining({ sourceChunkIds: [] }))
  })

  it('records original timestamps as inert metadata, never as fields resolveCanonicalNode could use as its own created_at/updated_at', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = resolveCanonicalNodeMock.mock.calls[0]![0] as { generationMetadata: Record<string, unknown> }
    expect(call.generationMetadata.importedFrom).toMatchObject({
      packageVersion: CURRENT_PACKAGE_VERSION,
      sourceVersion: PACKAGE_SOURCE_VERSION,
      originalCreatedAt: '2026-01-01T00:00:00.000Z',
      originalUpdatedAt: '2026-01-03T00:00:00.000Z',
    })
    expect(call).not.toHaveProperty('createdAt')
    expect(call).not.toHaveProperty('updatedAt')
  })

  it('preserves the rest of generationMetadata alongside the new importedFrom block', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = resolveCanonicalNodeMock.mock.calls[0]![0] as { generationMetadata: Record<string, unknown> }
    expect(call.generationMetadata.capability).toBe('extract-knowledge')
  })

  it('passes through the package metadata field unchanged', async () => {
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: fakeNode(), created: true })

    await importKnowledgeNodePackage(fakePackage({ metadata: { entityType: 'person' } }), {
      userId: 'importer-1',
      workspaceId: 'importer-workspace',
    })

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: { entityType: 'person' } }))
  })

  it('returns created: true when resolveCanonicalNode created a fresh node', async () => {
    const node = fakeNode()
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node, created: true })

    const result = await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toEqual({ node, created: true })
  })

  it('returns created: false and the existing node when resolveCanonicalNode reused a match — duplicate handling, never overwriting', async () => {
    const existingNode = fakeNode({ id: 'existing-node', title: 'Photosynthesis', description: 'A pre-existing, untouched description.' })
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: existingNode, created: false })

    const result = await importKnowledgeNodePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toEqual({ node: existingNode, created: false })
    expect(result.node.description).toBe('A pre-existing, untouched description.')
  })

  it('the knowledgeNodePackageImporter object delegates to the same function', async () => {
    resolveCanonicalNodeMock.mockResolvedValue({ node: fakeNode(), created: true })
    const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }
    const result = await knowledgeNodePackageImporter.import(fakePackage(), context)
    expect(result.node.id).toBe('node-new')
  })
})
