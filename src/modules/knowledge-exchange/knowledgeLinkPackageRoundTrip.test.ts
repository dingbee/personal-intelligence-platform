import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

/**
 * UX-14.5.10.4 integration test: export a relationship between two
 * concepts, serialize it, parse/validate the serialized text as if it
 * were a re-uploaded file, then import it into a different account —
 * the same lifecycle every prior package type's own round-trip test
 * already exercises, extended here to cover both endpoints and the
 * relationship itself.
 */

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

import { exportKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/exportKnowledgeLinkPackage'
import { parseKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/validateKnowledgeLinkPackage'
import { importKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage'

function fakeSourceNode(): KnowledgeNode {
  return {
    id: 'source-node-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'The process plants use to convert light into chemical energy.',
    source_type: 'document',
    source_id: 'exporter-document-1',
    source_chunk_ids: ['chunk-1'],
    generation_metadata: { capability: 'extract-knowledge' },
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function fakeTargetNode(): KnowledgeNode {
  return {
    id: 'target-node-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    node_type: 'concept',
    title: 'Chlorophyll',
    title_normalized: 'chlorophyll',
    description: 'The green pigment that absorbs light for photosynthesis.',
    source_type: 'document',
    source_id: 'exporter-document-1',
    source_chunk_ids: ['chunk-2'],
    generation_metadata: { capability: 'extract-knowledge' },
    metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function fakeSourceLink(): KnowledgeLink {
  return {
    id: 'link-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    source_type: 'knowledge_node',
    source_id: 'source-node-1',
    target_type: 'knowledge_node',
    target_id: 'target-node-1',
    created_at: '2026-01-05T00:00:00.000Z',
    relationship_type: 'requires',
    confidence: 0.82,
    generated_by: 'ai:detect-relationships',
    metadata: null,
  }
}

function fakeImportedNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'new-node',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: null,
    source_type: 'knowledge_node_import',
    source_id: 'random-uuid',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('export -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a relationship exported by one account is imported by another, resolving both endpoints and creating the edge between them', async () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })

    // Simulate the file round trip: serialize to text, then parse it back
    // as if a different account had just uploaded the downloaded file.
    const serialized = JSON.stringify(exportedPackage)
    const parsed = parseKnowledgeLinkPackage(serialized)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    // Import, as a different account, into a workspace the exporter was never in.
    const importedSourceNode = fakeImportedNode({ id: 'imported-source', title: 'Photosynthesis' })
    const importedTargetNode = fakeImportedNode({ id: 'imported-target', title: 'Chlorophyll' })
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: importedSourceNode, created: true })
      .mockResolvedValueOnce({ node: importedTargetNode, created: true })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeLinkPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.sourceNode).toBe(importedSourceNode)
    expect(result.targetNode).toBe(importedTargetNode)
    expect(result.relationshipType).toBe('requires')

    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Photosynthesis' }),
    )
    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Chlorophyll' }),
    )
    expect(upsertKnowledgeEdgesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceId: 'imported-source',
        targetId: 'imported-target',
        relationshipType: 'requires',
        confidence: 0.82,
        generatedBy: 'ai:detect-relationships',
      }),
    ])

    // Never the exporter's identity or original node ids.
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    const serializedPackage = JSON.stringify(parsed.package)
    expect(serializedPackage).not.toContain('source-node-1')
    expect(serializedPackage).not.toContain('target-node-1')
    expect(serializedPackage).not.toContain('exporter-1')
  })

  it('re-importing the same package resolves to the same existing endpoints and updates, not duplicates, the relationship', async () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })
    const parsed = parseKnowledgeLinkPackage(JSON.stringify(exportedPackage))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    const existingSourceNode = fakeImportedNode({ id: 'existing-source', title: 'Photosynthesis' })
    const existingTargetNode = fakeImportedNode({ id: 'existing-target', title: 'Chlorophyll' })
    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: existingSourceNode, created: false })
      .mockResolvedValueOnce({ node: existingTargetNode, created: false })
    upsertKnowledgeEdgesMock.mockResolvedValueOnce(undefined)

    const result = await importKnowledgeLinkPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.sourceCreated).toBe(false)
    expect(result.targetCreated).toBe(false)
    // upsertKnowledgeEdges' own onConflict key means this updates the same row, never creates a second one.
    expect(upsertKnowledgeEdgesMock).toHaveBeenCalledWith([
      expect.objectContaining({ sourceId: 'existing-source', targetId: 'existing-target' }),
    ])
  })

  it('rejects a hand-tampered package (unsupported version) before any endpoint is resolved', () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })
    const tampered = { ...exportedPackage, version: 999 }

    const parsed = parseKnowledgeLinkPackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalled()
    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download (malformed JSON) before any endpoint is resolved', () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })
    const truncated = JSON.stringify(exportedPackage).slice(0, -10)

    const parsed = parseKnowledgeLinkPackage(truncated)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.code).toBe('malformed_json')
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalled()
  })

  it('rejects a package hand-tampered into a self-loop before any endpoint is resolved', () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })
    const selfLoop = { ...exportedPackage, link: { ...exportedPackage.link, target: exportedPackage.link.source } }

    const parsed = parseKnowledgeLinkPackage(JSON.stringify(selfLoop))

    expect(parsed.valid).toBe(false)
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalled()
    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalled()
  })

  it('never creates the relationship if one endpoint fails to resolve — no broken links, no silent discard', async () => {
    const exportedPackage = exportKnowledgeLinkPackage({ link: fakeSourceLink(), sourceNode: fakeSourceNode(), targetNode: fakeTargetNode() })
    const parsed = parseKnowledgeLinkPackage(JSON.stringify(exportedPackage))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    resolveCanonicalNodeMock
      .mockResolvedValueOnce({ node: fakeImportedNode({ id: 'existing-source' }), created: false })
      .mockRejectedValueOnce(new Error('database unavailable'))

    await expect(
      importKnowledgeLinkPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' }),
    ).rejects.toThrow('database unavailable')

    expect(upsertKnowledgeEdgesMock).not.toHaveBeenCalled()
  })
})
