import { describe, expect, it } from 'vitest'
import {
  buildChapterHref,
  findAdjacentChapters,
  findChapterByIndex,
  findChapterForChunkId,
} from '@/modules/reader/intelligence/chapterResolver'

const CHAPTERS = [
  { index: 0, title: 'Introduction' },
  { index: 1, title: 'Middle' },
  { index: 2, title: 'Conclusion' },
]

const CHAPTERS_WITH_CHUNKS = [
  { index: 0, title: 'Introduction', chunkIds: ['c1', 'c2'] },
  { index: 1, title: 'Middle', chunkIds: ['c3'] },
]

describe('findChapterByIndex', () => {
  it('finds a chapter by index', () => {
    expect(findChapterByIndex(CHAPTERS, 1)?.title).toBe('Middle')
  })

  it('returns null when the index does not exist', () => {
    expect(findChapterByIndex(CHAPTERS, 99)).toBeNull()
  })
})

describe('findAdjacentChapters', () => {
  it('finds both neighbors for a middle chapter', () => {
    const { previous, next } = findAdjacentChapters(CHAPTERS, 1)
    expect(previous?.title).toBe('Introduction')
    expect(next?.title).toBe('Conclusion')
  })

  it('has no previous chapter at index 0', () => {
    expect(findAdjacentChapters(CHAPTERS, 0).previous).toBeNull()
  })

  it('has no next chapter at the last index', () => {
    expect(findAdjacentChapters(CHAPTERS, 2).next).toBeNull()
  })
})

describe('findChapterForChunkId', () => {
  it('finds the chapter containing a chunk id', () => {
    expect(findChapterForChunkId(CHAPTERS_WITH_CHUNKS, 'c3')?.title).toBe('Middle')
  })

  it('returns null when no chapter contains the chunk id', () => {
    expect(findChapterForChunkId(CHAPTERS_WITH_CHUNKS, 'unknown')).toBeNull()
  })
})

describe('buildChapterHref', () => {
  it('matches referenceFormatter\'s chapter href convention exactly', () => {
    expect(buildChapterHref('doc-1', 3)).toBe('/library/doc-1/read?chapter=3')
  })
})
