import { describe, expect, it } from 'vitest'
import type { KnowledgeNode } from '@/shared/types/database'
import {
  exportKnowledgeNodePackage,
  knowledgeNodePackageExporter,
  knowledgeNodePackageFilename,
} from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    node_type: 'concept',
    title: 'Photosynthesis',
    title_normalized: 'photosynthesis',
    description: 'The process plants use to convert light into chemical energy.',
    source_type: 'document',
    source_id: 'document-1',
    source_chunk_ids: ['chunk-1', 'chunk-2'],
    generation_metadata: { capability: 'extract-knowledge', model: 'claude-sonnet-5', generated_at: '2026-01-01T00:00:00.000Z' },
    metadata: { entityType: null },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('exportKnowledgeNodePackage', () => {
  it('builds a versioned package with the allow-listed node content', () => {
    const pkg = exportKnowledgeNodePackage(fakeNode())

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(typeof pkg.exportedAt).toBe('string')
    expect(pkg.node).toEqual({
      nodeType: 'concept',
      title: 'Photosynthesis',
      description: 'The process plants use to convert light into chemical energy.',
      metadata: { entityType: null },
      generationMetadata: { capability: 'extract-knowledge', model: 'claude-sonnet-5', generated_at: '2026-01-01T00:00:00.000Z' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    })
  })

  it('never includes id, user_id, workspace_id, source_type, source_id, or source_chunk_ids — allow-list, not deny-list', () => {
    const pkg = exportKnowledgeNodePackage(fakeNode())
    const serialized = JSON.stringify(pkg)

    expect(serialized).not.toContain('node-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
    expect(serialized).not.toContain('document-1')
    expect(serialized).not.toContain('chunk-1')
    expect(serialized).not.toContain('title_normalized')
  })

  it('preserves a null description/metadata/generationMetadata as null', () => {
    const pkg = exportKnowledgeNodePackage(fakeNode({ description: null, metadata: null, generation_metadata: null }))
    expect(pkg.node.description).toBeNull()
    expect(pkg.node.metadata).toBeNull()
    expect(pkg.node.generationMetadata).toBeNull()
  })

  it('exports an entity node type correctly', () => {
    const pkg = exportKnowledgeNodePackage(fakeNode({ node_type: 'entity', title: 'Marie Curie' }))
    expect(pkg.node.nodeType).toBe('entity')
    expect(pkg.node.title).toBe('Marie Curie')
  })

  it('the knowledgeNodePackageExporter object delegates to the same function', () => {
    const node = fakeNode()
    expect(knowledgeNodePackageExporter.export(node)).toEqual(exportKnowledgeNodePackage(node))
  })
})

describe('knowledgeNodePackageFilename', () => {
  it('slugifies the title and appends .json', () => {
    expect(knowledgeNodePackageFilename('Marie Curie: Radioactivity!')).toBe('marie-curie-radioactivity.json')
  })

  it('falls back to a generic name for an empty/unsluggable title', () => {
    expect(knowledgeNodePackageFilename('   ')).toBe('knowledge-node-export.json')
  })
})
