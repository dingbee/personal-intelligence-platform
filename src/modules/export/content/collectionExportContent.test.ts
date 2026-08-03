import { describe, expect, it } from 'vitest'
import { buildCollectionExportContent } from '@/modules/export/content/collectionExportContent'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

function fakeItems(): EvidenceItem[] {
  return [
    { type: 'note', id: 'note-1', label: 'My Note', createdAt: '2026-01-01T00:00:00.000Z' },
    { type: 'knowledge_node', id: 'node-1', label: 'Photosynthesis', createdAt: '2026-01-02T00:00:00.000Z' },
    { type: 'knowledge_node', id: 'node-2', label: 'Chlorophyll', createdAt: '2026-01-03T00:00:00.000Z' },
  ]
}

describe('buildCollectionExportContent', () => {
  it('carries the collection name and description', () => {
    const content = buildCollectionExportContent({ name: 'Plant Biology', description: 'Curated concepts.' }, [])
    expect(content.title).toBe('Plant Biology')
    expect(content.subtitle).toBe('Curated concepts.')
  })

  it('omits the subtitle when description is null', () => {
    const content = buildCollectionExportContent({ name: 'Plant Biology', description: null }, [])
    expect(content.subtitle).toBeUndefined()
  })

  it('groups members by type into labeled list sections', () => {
    const content = buildCollectionExportContent({ name: 'Plant Biology', description: null }, fakeItems())
    const notesSection = content.sections.find((s) => s.heading === 'Notes')
    const conceptsSection = content.sections.find((s) => s.heading === 'Concepts')

    expect(notesSection?.format).toBe('list')
    expect(notesSection?.body[0]).toContain('My Note')
    expect(conceptsSection?.body).toHaveLength(2)
    expect(conceptsSection?.body[0]).toContain('Photosynthesis')
    expect(conceptsSection?.body[1]).toContain('Chlorophyll')
  })

  it('produces no sections for an empty collection', () => {
    const content = buildCollectionExportContent({ name: 'Empty', description: null }, [])
    expect(content.sections).toEqual([])
  })

  it('never carries member ids', () => {
    const content = buildCollectionExportContent({ name: 'Plant Biology', description: null }, fakeItems())
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('note-1')
    expect(serialized).not.toContain('node-1')
    expect(serialized).not.toContain('node-2')
  })
})
