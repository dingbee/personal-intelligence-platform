import { describe, expect, it } from 'vitest'
import type { Note, Tag } from '@/shared/types/database'
import { exportNotePackage, notePackageFilename, notePackageExporter } from '@/modules/knowledge-exchange/notes/exportNotePackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    collection_id: null,
    document_id: null,
    title: 'Trip planning notes',
    content: 'Some prose content.',
    source_chunk_ids: null,
    generation_metadata: { creationMethod: 'user_created', artifactKind: 'note' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

function fakeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: 'tag-1', user_id: 'user-1', name: 'travel', created_at: '2026-01-01T00:00:00.000Z', ...overrides }
}

describe('exportNotePackage', () => {
  it('builds a versioned package with the note content, tags, and timestamps', () => {
    const pkg = exportNotePackage(fakeNote(), [fakeTag({ name: 'travel' }), fakeTag({ id: 'tag-2', name: 'italy' })])

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(typeof pkg.exportedAt).toBe('string')
    expect(pkg.note).toEqual({
      title: 'Trip planning notes',
      content: 'Some prose content.',
      tags: ['travel', 'italy'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
      generationMetadata: { creationMethod: 'user_created', artifactKind: 'note' },
    })
  })

  it('never includes id, user_id, or workspace_id — allow-list, not deny-list', () => {
    const pkg = exportNotePackage(fakeNote(), [])
    const serialized = JSON.stringify(pkg)

    expect(serialized).not.toContain('note-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
  })

  it('produces an empty tags array for a note with no tags', () => {
    const pkg = exportNotePackage(fakeNote(), [])
    expect(pkg.note.tags).toEqual([])
  })

  it('preserves a null generationMetadata as null, not an empty object', () => {
    const pkg = exportNotePackage(fakeNote({ generation_metadata: null }), [])
    expect(pkg.note.generationMetadata).toBeNull()
  })

  it('the notePackageExporter object delegates to the same function', () => {
    const note = fakeNote()
    expect(notePackageExporter.export({ note, tags: [] })).toEqual(exportNotePackage(note, []))
  })
})

describe('notePackageFilename', () => {
  it('slugifies the title and appends .json', () => {
    expect(notePackageFilename('Trip Planning: Italy 2026!')).toBe('trip-planning-italy-2026.json')
  })

  it('falls back to a generic name for an empty/unsluggable title', () => {
    expect(notePackageFilename('   ')).toBe('note-export.json')
  })
})
