import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeNode } from '@/shared/types/database'

/**
 * UX-14.5.10.1 integration test: export a knowledge node, serialize it,
 * parse/validate the serialized text as if it were a re-uploaded file,
 * then import it — the same lifecycle
 * `notePackageRoundTrip.test.ts` already exercises for Notes.
 */

const { resolveCanonicalNodeMock } = vi.hoisted(() => ({ resolveCanonicalNodeMock: vi.fn() }))

vi.mock('@/modules/knowledge-intelligence/api/knowledgeNodeResolution', () => ({
  resolveCanonicalNode: resolveCanonicalNodeMock,
}))

import { exportKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { parseKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/validateKnowledgeNodePackage'
import { importKnowledgeNodePackage, KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'

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
    source_chunk_ids: ['chunk-1', 'chunk-2'],
    generation_metadata: { capability: 'extract-knowledge', model: 'claude-sonnet-5' },
    metadata: { entityType: null },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }
}

function fakeCreatedNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'new-node-1',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'The process plants use to convert light into chemical energy.',
    source_type: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
    source_id: 'fresh-random-uuid',
    source_chunk_ids: [],
    generation_metadata: null,
    metadata: { entityType: null },
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('export -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a node exported by one account and imported by another produces a correct, brand-new node', async () => {
    const exportedPackage = exportKnowledgeNodePackage(fakeSourceNode())

    // Simulate the file round trip: serialize to text, then parse it back
    // as if a different account had just uploaded the downloaded file.
    const serialized = JSON.stringify(exportedPackage)
    const parsed = parseKnowledgeNodePackage(serialized)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    // Import, as a different account, into a workspace the exporter was never in.
    const createdNode = fakeCreatedNode()
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: createdNode, created: true })

    const result = await importKnowledgeNodePackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.node).toBe(createdNode)
    expect(result.created).toBe(true)
    expect(resolveCanonicalNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'importer-1',
        workspaceId: 'importer-workspace',
        title: 'Photosynthesis',
        description: 'The process plants use to convert light into chemical energy.',
      }),
    )
    // Never the exporter's identity or original provenance.
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'exporter-workspace' }))
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'document', sourceId: 'exporter-document-1' }))
  })

  it('a second import of the same package into an account that already has that concept reuses it — never overwrites', async () => {
    const exportedPackage = exportKnowledgeNodePackage(fakeSourceNode())
    const parsed = parseKnowledgeNodePackage(JSON.stringify(exportedPackage))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    const existingNode = fakeCreatedNode({ id: 'already-existing-node', description: 'Locally edited description — must survive.' })
    resolveCanonicalNodeMock.mockResolvedValueOnce({ node: existingNode, created: false })

    const result = await importKnowledgeNodePackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.created).toBe(false)
    expect(result.node.description).toBe('Locally edited description — must survive.')
  })

  it('rejects a hand-tampered package (unsupported version) before it ever reaches import', () => {
    const exportedPackage = exportKnowledgeNodePackage(fakeSourceNode())
    const tampered = { ...exportedPackage, version: 999 }

    const parsed = parseKnowledgeNodePackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download (malformed JSON) before it ever reaches import', () => {
    const exportedPackage = exportKnowledgeNodePackage(fakeSourceNode())
    const truncated = JSON.stringify(exportedPackage).slice(0, -10)

    const parsed = parseKnowledgeNodePackage(truncated)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.code).toBe('malformed_json')
    expect(resolveCanonicalNodeMock).not.toHaveBeenCalled()
  })
})
