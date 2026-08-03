import { describe, expect, it } from 'vitest'
import { buildDocumentExportContent } from '@/modules/export/content/documentExportContent'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { ExtractionMetadata } from '@/shared/types/database'

function fakeDocument(overrides: Partial<DocumentWithTags> = {}): DocumentWithTags {
  return {
    id: 'document-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    collection_id: null,
    title: 'Field Notes',
    file_name: 'field-notes.pdf',
    file_path: 'user-1/document-1-field-notes.pdf',
    file_type: 'pdf',
    file_size: 204800,
    status: 'ready',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    tags: [],
    ...overrides,
  }
}

function fakeMetadata(overrides: Partial<ExtractionMetadata> = {}): ExtractionMetadata {
  return {
    document_id: 'document-1',
    user_id: 'user-1',
    title: 'Field Notes',
    author: 'Jane Doe',
    language: 'en',
    page_count: 42,
    chapter_count: 5,
    word_count: 12000,
    char_count: 70000,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildDocumentExportContent', () => {
  it('carries the title and a file-type/size subtitle', () => {
    const content = buildDocumentExportContent(fakeDocument(), null)
    expect(content.title).toBe('Field Notes')
    expect(content.subtitle).toContain('PDF')
  })

  it('renders tags as a list section when present', () => {
    const content = buildDocumentExportContent(fakeDocument({ tags: [{ id: 't1', name: 'research' }] }), null)
    const tagsSection = content.sections.find((s) => s.heading === 'Tags')
    expect(tagsSection?.body).toEqual(['research'])
  })

  it('renders extraction metadata as a details section', () => {
    const content = buildDocumentExportContent(fakeDocument(), fakeMetadata())
    const details = content.sections.find((s) => s.heading === 'Details')
    expect(details?.body).toEqual(['Author: Jane Doe', 'Language: en', 'Pages: 42', 'Chapters: 5', 'Words: 12000'])
  })

  it('shows a placeholder when no metadata exists yet', () => {
    const content = buildDocumentExportContent(fakeDocument(), null)
    expect(content.sections[0]!.body).toEqual(['No extracted metadata available for this document yet.'])
  })

  it('never carries id/user_id/workspace_id/collection_id/file_path', () => {
    const content = buildDocumentExportContent(fakeDocument({ tags: [{ id: 't1', name: 'research' }] }), fakeMetadata())
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('document-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
    expect(serialized).not.toContain('field-notes.pdf')
  })
})
