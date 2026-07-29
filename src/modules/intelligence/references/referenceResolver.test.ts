import { describe, expect, it } from 'vitest'
import { groupChunkLocationsIntoReferences } from '@/modules/intelligence/references/referenceResolver'

describe('groupChunkLocationsIntoReferences', () => {
  it('returns a chapter reference for a chunk with chapter data', () => {
    const refs = groupChunkLocationsIntoReferences(
      [{ id: 'c1', document_id: 'doc-1', chapter_index: 3, chapter_title: 'The Turning Point' }],
      new Map([['doc-1', 'Atomic Habits']]),
    )
    expect(refs).toEqual([
      { type: 'chapter', documentId: 'doc-1', documentTitle: 'Atomic Habits', chapterIndex: 3, chapterTitle: 'The Turning Point' },
    ])
  })

  it('falls back to a document reference when no chunk has chapter data', () => {
    const refs = groupChunkLocationsIntoReferences(
      [{ id: 'c1', document_id: 'doc-1', chapter_index: null, chapter_title: null }],
      new Map([['doc-1', 'Some PDF']]),
    )
    expect(refs).toEqual([{ type: 'document', id: 'doc-1', title: 'Some PDF' }])
  })

  it('deduplicates multiple chunks from the same chapter into one reference', () => {
    const refs = groupChunkLocationsIntoReferences(
      [
        { id: 'c1', document_id: 'doc-1', chapter_index: 4, chapter_title: 'Chapter 4' },
        { id: 'c2', document_id: 'doc-1', chapter_index: 4, chapter_title: 'Chapter 4' },
      ],
      new Map([['doc-1', 'A Book']]),
    )
    expect(refs).toHaveLength(1)
  })

  it('produces one reference per distinct chapter within the same document', () => {
    const refs = groupChunkLocationsIntoReferences(
      [
        { id: 'c1', document_id: 'doc-1', chapter_index: 1, chapter_title: 'Chapter 1' },
        { id: 'c2', document_id: 'doc-1', chapter_index: 2, chapter_title: 'Chapter 2' },
      ],
      new Map([['doc-1', 'A Book']]),
    )
    expect(refs).toHaveLength(2)
  })

  it('handles multiple documents independently', () => {
    const refs = groupChunkLocationsIntoReferences(
      [
        { id: 'c1', document_id: 'doc-1', chapter_index: 1, chapter_title: 'Chapter 1' },
        { id: 'c2', document_id: 'doc-2', chapter_index: null, chapter_title: null },
      ],
      new Map([
        ['doc-1', 'Book One'],
        ['doc-2', 'Report Two'],
      ]),
    )
    expect(refs).toEqual([
      { type: 'chapter', documentId: 'doc-1', documentTitle: 'Book One', chapterIndex: 1, chapterTitle: 'Chapter 1' },
      { type: 'document', id: 'doc-2', title: 'Report Two' },
    ])
  })

  it('falls back to a generic title when a document title is missing from the map', () => {
    const refs = groupChunkLocationsIntoReferences(
      [{ id: 'c1', document_id: 'doc-missing', chapter_index: null, chapter_title: null }],
      new Map(),
    )
    expect(refs).toEqual([{ type: 'document', id: 'doc-missing', title: 'Untitled document' }])
  })

  it('falls back to "Chapter N" when chapter_title is null', () => {
    const refs = groupChunkLocationsIntoReferences(
      [{ id: 'c1', document_id: 'doc-1', chapter_index: 2, chapter_title: null }],
      new Map([['doc-1', 'A Book']]),
    )
    expect(refs[0]).toMatchObject({ chapterTitle: 'Chapter 3' })
  })
})
