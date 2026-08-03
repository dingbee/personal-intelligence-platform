import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import {
  exportKnowledgeLinkPackage,
  knowledgeLinkPackageExporter,
  knowledgeLinkPackageFilename,
} from '@/modules/knowledge-exchange/knowledge-links/exportKnowledgeLinkPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
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
    ...overrides,
  }
}

function fakeLink(overrides: Partial<KnowledgeLink> = {}): KnowledgeLink {
  return {
    id: 'link-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    source_type: 'knowledge_node',
    source_id: 'node-1',
    target_type: 'knowledge_node',
    target_id: 'node-2',
    created_at: '2026-01-05T00:00:00.000Z',
    relationship_type: 'requires',
    confidence: 0.82,
    generated_by: 'ai:detect-relationships',
    metadata: null,
    ...overrides,
  }
}

describe('exportKnowledgeLinkPackage', () => {
  it('includes correct relationship metadata and both endpoints', () => {
    const sourceNode = fakeNode({ id: 'node-1', title: 'Photosynthesis' })
    const targetNode = fakeNode({
      id: 'node-2',
      title: 'Chlorophyll',
      node_type: 'concept',
      description: 'The green pigment that absorbs light for photosynthesis.',
    })
    const pkg = exportKnowledgeLinkPackage({ link: fakeLink(), sourceNode, targetNode })

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(pkg.link).toEqual({
      relationshipType: 'requires',
      confidence: 0.82,
      generatedBy: 'ai:detect-relationships',
      source: { nodeType: 'concept', title: 'Photosynthesis', description: sourceNode.description },
      target: { nodeType: 'concept', title: 'Chlorophyll', description: 'The green pigment that absorbs light for photosynthesis.' },
    })
  })

  it('falls back to "related_to" when relationship_type is null', () => {
    const pkg = exportKnowledgeLinkPackage({
      link: fakeLink({ relationship_type: null }),
      sourceNode: fakeNode(),
      targetNode: fakeNode({ id: 'node-2', title: 'Chlorophyll' }),
    })
    expect(pkg.link.relationshipType).toBe('related_to')
  })

  it('excludes ids, user_id, workspace_id, and every timestamp — allow-list only', () => {
    const pkg = exportKnowledgeLinkPackage({
      link: fakeLink(),
      sourceNode: fakeNode(),
      targetNode: fakeNode({ id: 'node-2', title: 'Chlorophyll' }),
    })
    const serialized = JSON.stringify(pkg)

    expect(serialized).not.toContain('exporter-1')
    expect(serialized).not.toContain('exporter-workspace')
    expect(serialized).not.toContain('node-1')
    expect(serialized).not.toContain('node-2')
    expect(serialized).not.toContain('link-1')
    expect(serialized).not.toContain('exporter-document-1')
    expect(serialized).not.toContain('chunk-1')
    expect(serialized).not.toContain('2026-01-01')
    expect(serialized).not.toContain('2026-01-05')
  })

  it('never carries source_chunk_ids or generation_metadata from either endpoint', () => {
    const pkg = exportKnowledgeLinkPackage({
      link: fakeLink(),
      sourceNode: fakeNode(),
      targetNode: fakeNode({ id: 'node-2', title: 'Chlorophyll' }),
    })
    expect(Object.keys(pkg.link.source)).toEqual(['nodeType', 'title', 'description'])
    expect(Object.keys(pkg.link.target)).toEqual(['nodeType', 'title', 'description'])
  })

  it('the knowledgeLinkPackageExporter object delegates to the same function', () => {
    // Freeze time so both calls' exportedAt (new Date().toISOString()) land
    // in the same millisecond — otherwise this assertion is a rare, real
    // flake, not a bug in either call.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T00:00:00.000Z'))
    try {
      const source = { link: fakeLink(), sourceNode: fakeNode(), targetNode: fakeNode({ id: 'node-2', title: 'Chlorophyll' }) }
      expect(knowledgeLinkPackageExporter.export(source)).toEqual(exportKnowledgeLinkPackage(source))
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('knowledgeLinkPackageFilename', () => {
  it('slugifies both titles into a safe .json filename', () => {
    expect(knowledgeLinkPackageFilename('Photosynthesis', 'Chlorophyll')).toBe('photosynthesis-chlorophyll.json')
  })

  it('falls back to a generic name for empty/symbol-only titles', () => {
    expect(knowledgeLinkPackageFilename('   ', '!!!')).toBe('knowledge-link-export.json')
  })
})
