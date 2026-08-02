import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, Tag } from '@/shared/types/database'

/**
 * UX-14.5.9 integration test: export a note, serialize it, parse/validate
 * the serialized text as if it were a re-uploaded file, then import it —
 * the full same-instance lifecycle the discovery doc's §6 describes,
 * minus only the actual file-download round trip (covered by
 * `downloadTextFile`, already tested elsewhere and reused unchanged).
 */

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

import { exportNotePackage } from '@/modules/knowledge-exchange/notes/exportNotePackage'
import { parseNotePackage } from '@/modules/knowledge-exchange/notes/validateNotePackage'
import { importNotePackage } from '@/modules/knowledge-exchange/notes/importNotePackage'

function fakeSourceNote(): Note {
  return {
    id: 'source-note-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    collection_id: null,
    document_id: null,
    title: 'Roman itinerary',
    content: 'Day 1: Colosseum. Day 2: Vatican.',
    source_chunk_ids: ['chunk-1', 'chunk-2'],
    generation_metadata: { creationMethod: 'user_created', artifactKind: 'note' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }
}

function fakeTags(): Tag[] {
  return [
    { id: 'tag-1', user_id: 'exporter-1', name: 'travel', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-2', user_id: 'exporter-1', name: 'italy', created_at: '2026-01-01T00:00:00.000Z' },
  ]
}

function fakeCreatedNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'new-note-1',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    collection_id: null,
    document_id: null,
    title: 'Roman itinerary',
    content: 'Day 1: Colosseum. Day 2: Vatican.',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('export -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a note exported by one account and imported by another produces a correct, brand-new note', async () => {
    // Export, from the exporter's already-fetched note + tags.
    const exportedPackage = exportNotePackage(fakeSourceNote(), fakeTags())

    // Simulate the file round trip: serialize to text, then parse it back
    // as if a different account had just uploaded the downloaded file.
    const serialized = JSON.stringify(exportedPackage)
    const parsed = parseNotePackage(serialized)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    // Import, as a different account, into a workspace the exporter was never in.
    const createdNote = fakeCreatedNote()
    createNoteMock.mockResolvedValueOnce(createdNote)

    const result = await importNotePackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(createdNote)
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'importer-1',
        workspaceId: 'importer-workspace',
        title: 'Roman itinerary',
        content: 'Day 1: Colosseum. Day 2: Vatican.',
      }),
    )
    // Never the exporter's identity.
    expect(createNoteMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(createNoteMock).not.toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'exporter-workspace' }))

    // Tags re-resolved by name for the importer's own account.
    expect(addTagToNoteMock).toHaveBeenCalledWith({ noteId: createdNote.id, tagName: 'travel', userId: 'importer-1' })
    expect(addTagToNoteMock).toHaveBeenCalledWith({ noteId: createdNote.id, tagName: 'italy', userId: 'importer-1' })

    // Fully integrated, same as any native note (discovery doc §4.3).
    expect(indexNoteMock).toHaveBeenCalledWith(createdNote, 'importer-workspace')
    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', sourceId: createdNote.id }),
    )
  })

  it('rejects a hand-tampered package (unsupported version) before it ever reaches import', () => {
    const exportedPackage = exportNotePackage(fakeSourceNote(), fakeTags())
    const tampered = { ...exportedPackage, version: 999 }

    const parsed = parseNotePackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(createNoteMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download (malformed JSON) before it ever reaches import', () => {
    const exportedPackage = exportNotePackage(fakeSourceNote(), fakeTags())
    const truncated = JSON.stringify(exportedPackage).slice(0, -10)

    const parsed = parseNotePackage(truncated)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.code).toBe('malformed_json')
    expect(createNoteMock).not.toHaveBeenCalled()
  })
})
