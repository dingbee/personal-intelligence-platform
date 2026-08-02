import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@/shared/types/database'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { createNoteMock, addTagToNoteMock, indexNoteMock, linkKnownConceptsToSourceMock } = vi.hoisted(() => ({
  createNoteMock: vi.fn(),
  addTagToNoteMock: vi.fn(async () => {}),
  indexNoteMock: vi.fn(async () => {}),
  linkKnownConceptsToSourceMock: vi.fn(async () => {}),
}))

vi.mock('@/modules/notes/api/notes', () => ({ createNote: createNoteMock }))
vi.mock('@/modules/notes/api/noteTags', () => ({ addTagToNote: addTagToNoteMock }))
vi.mock('@/modules/search/indexing/indexNote', () => ({ indexNote: indexNoteMock }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: linkKnownConceptsToSourceMock }))

import { importNotePackage, notePackageImporter } from '@/modules/knowledge-exchange/notes/importNotePackage'

function fakeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-new',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    collection_id: null,
    document_id: null,
    title: 'Trip planning notes',
    content: 'Some prose content.',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakePackage(overrides: Partial<NotePackage['note']> = {}): NotePackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    note: {
      title: 'Trip planning notes',
      content: 'Some prose content.',
      tags: ['travel', 'italy'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      generationMetadata: { creationMethod: 'user_created' },
      ...overrides,
    },
  }
}

describe('importNotePackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new note owned by the importer, in the chosen workspace', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'importer-1',
        workspaceId: 'importer-workspace',
        title: 'Trip planning notes',
        content: 'Some prose content.',
      }),
    )
  })

  it('supports importing into no workspace (personal)', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote({ workspace_id: null }))

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: null })

    expect(createNoteMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: null }))
  })

  it('records original timestamps as inert metadata, never as the new row\'s own created_at/updated_at', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = createNoteMock.mock.calls[0]![0] as { generationMetadata: Record<string, unknown> }
    expect(call.generationMetadata.importedFrom).toMatchObject({
      packageVersion: CURRENT_PACKAGE_VERSION,
      sourceVersion: PACKAGE_SOURCE_VERSION,
      originalCreatedAt: '2026-01-01T00:00:00.000Z',
      originalUpdatedAt: '2026-01-03T00:00:00.000Z',
    })
    // createNote itself decides the new row's created_at/updated_at (DB defaults) — this function never sets them directly.
    expect(call).not.toHaveProperty('createdAt')
    expect(call).not.toHaveProperty('updatedAt')
  })

  it('preserves the rest of generationMetadata alongside the new importedFrom block', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = createNoteMock.mock.calls[0]![0] as { generationMetadata: Record<string, unknown> }
    expect(call.generationMetadata.creationMethod).toBe('user_created')
  })

  it('re-resolves every tag by name for the importing account', async () => {
    const note = fakeNote()
    createNoteMock.mockResolvedValueOnce(note)

    await importNotePackage(fakePackage({ tags: ['travel', 'italy'] }), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(addTagToNoteMock).toHaveBeenCalledWith({ noteId: note.id, tagName: 'travel', userId: 'importer-1' })
    expect(addTagToNoteMock).toHaveBeenCalledWith({ noteId: note.id, tagName: 'italy', userId: 'importer-1' })
    expect(addTagToNoteMock).toHaveBeenCalledTimes(2)
  })

  it('adds no tags for a package with an empty tags list', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())

    await importNotePackage(fakePackage({ tags: [] }), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(addTagToNoteMock).not.toHaveBeenCalled()
  })

  it('indexes the note and links known concepts, same as any other note-creation path', async () => {
    const note = fakeNote()
    createNoteMock.mockResolvedValueOnce(note)

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(indexNoteMock).toHaveBeenCalledWith(note, 'importer-workspace')
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', sourceType: 'note', sourceId: note.id }),
    )
  })

  it('returns the newly created note', async () => {
    const note = fakeNote({ id: 'note-77' })
    createNoteMock.mockResolvedValueOnce(note)

    const result = await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(note)
  })

  it('always inserts a fresh row — never looks up or updates an existing note (never overwrites)', async () => {
    createNoteMock.mockResolvedValueOnce(fakeNote())

    await importNotePackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    // createNote is the only note-table write this function makes.
    expect(createNoteMock).toHaveBeenCalledTimes(1)
  })

  it('the notePackageImporter object delegates to the same function', async () => {
    createNoteMock.mockResolvedValue(fakeNote())
    const context = { userId: 'importer-1', workspaceId: 'importer-workspace' }
    const result = await notePackageImporter.import(fakePackage(), context)
    expect(result.id).toBe('note-new')
  })
})
