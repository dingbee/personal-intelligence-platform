import { describe, expect, it } from 'vitest'
import { buildNoteExportContent } from '@/modules/export/content/noteExportContent'
import type { Note, Tag } from '@/shared/types/database'

function fakeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    collection_id: null,
    document_id: null,
    title: 'My Note',
    content: 'First paragraph.\n\nSecond paragraph.',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakeTags(): Tag[] {
  return [{ id: 'tag-1', user_id: 'user-1', name: 'research', created_at: '2026-01-01T00:00:00.000Z' }]
}

describe('buildNoteExportContent', () => {
  it('carries the title and splits content into paragraphs', () => {
    const content = buildNoteExportContent(fakeNote(), [])
    expect(content.title).toBe('My Note')
    expect(content.sections).toHaveLength(1)
    expect(content.sections[0]!.body).toEqual(['First paragraph.', 'Second paragraph.'])
    expect(content.sections[0]!.format).toBeUndefined()
  })

  it('summarizes tags into the subtitle when present', () => {
    const content = buildNoteExportContent(fakeNote(), fakeTags())
    expect(content.subtitle).toBe('Tags: research')
  })

  it('omits the subtitle entirely when there are no tags', () => {
    const content = buildNoteExportContent(fakeNote(), [])
    expect(content.subtitle).toBeUndefined()
  })

  it('never carries id/user_id/workspace_id/generation_metadata', () => {
    const content = buildNoteExportContent(fakeNote(), fakeTags())
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('note-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
  })
})
