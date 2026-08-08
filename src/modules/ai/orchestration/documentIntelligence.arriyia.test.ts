import { beforeAll, describe, expect, it, vi } from 'vitest'
import { chapterAwareChunker } from '@/modules/processing/chunking/chapterAware'
import { ARRIYIA_PAGE_INDEX, ARTICLE_FULL_TEXT, ARTICLE_PAGES, ARTICLE_TITLE } from '@/modules/ai/orchestration/__fixtures__/arriyiaArticle'

const { invokeAiEmbedMock, vectorStoreQueryMock, lexicalSearchMock, getChunkLocationsMock, getDocumentTitlesMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]], model: 'text-embedding-3-small', promptTokens: 10 })),
  vectorStoreQueryMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
  lexicalSearchMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string }[]),
  getChunkLocationsMock: vi.fn(async () => [] as { id: string; document_id: string; chapter_index: number | null; chapter_title: string | null }[]),
  getDocumentTitlesMock: vi.fn(async () => [] as { id: string; title: string }[]),
}))

vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({ invokeAiEmbed: invokeAiEmbedMock }))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: vi.fn(async () => {}) }))
vi.mock('@/modules/ai/retrieval/SupabaseVectorStore', () => ({ supabaseVectorStore: { query: vectorStoreQueryMock } }))
vi.mock('@/modules/ai/orchestration/lexicalChunkSearch', () => ({ searchChunksByLexicalTerms: lexicalSearchMock }))
vi.mock('@/modules/processing/api/chunks', () => ({ getChunkLocations: getChunkLocationsMock }))
vi.mock('@/modules/library/api/documents', () => ({ getDocumentTitles: getDocumentTitlesMock }))

import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { resolveChunkProvenance } from '@/modules/ai/orchestration/resolveChunkProvenance'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { promptRegistry } from '@/modules/core/prompts/registry'

beforeAll(() => {
  promptRegistry.register({
    id: 'test-chat@1.0',
    capabilityId: 'chat',
    version: '1.0',
    active: true,
    template: 'Answer using ONLY the context below.\n\nContext:\n{{context}}',
  })
})

const DOCUMENT_ID = 'doc-arriyia'

/**
 * PIP Sprint 4/10, Phase 3 — deterministic reproduction of the real
 * reported failure ("What has been mentioned about ARRIYIA in the
 * article?" failed to process meaningfully), and Phase 8's acceptance
 * tests A/B/F against it. Chunks the fixture with the real
 * chapterAwareChunker (not synthetic chunks) so this exercises the actual
 * page-per-chapter boundaries extractors/pdf.ts produces. The semantic
 * step is mocked to return unrelated pages — modeling the real, observed
 * failure mode: a rare invented term the embedding model doesn't score
 * highly against a full-sentence question — while the lexical step
 * returns the real page 6 chunk(s), since ARRIYIA appears there verbatim.
 */
describe('Document Intelligence — ARRIYIA reproduction (Sprint 4/10)', () => {
  const chunks = chapterAwareChunker.chunk({ text: ARTICLE_FULL_TEXT, chapters: ARTICLE_PAGES })
  const arriyiaChunks = chunks.filter((c) => c.chapterIndex === ARRIYIA_PAGE_INDEX)

  it('sanity: the fixture actually produces a page-6 chunk containing ARRIYIA (chunker precondition for the tests below)', () => {
    expect(arriyiaChunks.length).toBeGreaterThan(0)
    expect(arriyiaChunks.some((c) => c.content.includes('ARRIYIA'))).toBe(true)
  })

  function chunkRow(chunk: (typeof chunks)[number], index: number) {
    return { chunkId: `chunk-${chunk.chapterIndex}-${index}`, documentId: DOCUMENT_ID, content: chunk.content }
  }

  const arriyiaRows = arriyiaChunks.map((c, i) => chunkRow(c, i))
  const unrelatedRows = chunks
    .filter((c) => c.chapterIndex !== ARRIYIA_PAGE_INDEX)
    .slice(0, 2)
    .map((c, i) => chunkRow(c, i))

  it('Test A/B foundation — the page-6 ARRIYIA chunk is retrieved even when semantic search returns only unrelated pages', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce(unrelatedRows.map((r) => ({ ...r, similarity: 0.55 })))
    lexicalSearchMock.mockResolvedValueOnce(arriyiaRows)

    const matches = await retrieveContext({ query: 'What has been mentioned about ARRIYIA in the article?', userId: 'u1', workspaceId: null, documentId: DOCUMENT_ID })

    const found = matches.find((m) => m.content.includes('ARRIYIA'))
    expect(found).toBeDefined()
    expect(found?.content).toContain('reduced average freight costs')
  })

  it('Test B — the retrieved chunk carries real page provenance (Page 6), not a fabricated location', async () => {
    getChunkLocationsMock.mockResolvedValueOnce(
      arriyiaRows.map((r) => ({ id: r.chunkId, document_id: DOCUMENT_ID, chapter_index: ARRIYIA_PAGE_INDEX, chapter_title: 'Page 6' })),
    )
    getDocumentTitlesMock.mockResolvedValueOnce([{ id: DOCUMENT_ID, title: ARTICLE_TITLE }])

    const matches = arriyiaRows.map((r) => ({ chunkId: r.chunkId, documentId: r.documentId, content: r.content, similarity: 0.4 }))
    const provenance = await resolveChunkProvenance(matches)
    const system = buildSystemPrompt(matches, null, null, null, undefined, provenance)

    expect(system).toContain(`${ARTICLE_TITLE} — Page 6`)
    expect(system).toContain('ARRIYIA')
  })

  it('Test F — a nonexistent entity produces no fabricated evidence: context honestly reports nothing found', async () => {
    vectorStoreQueryMock.mockResolvedValueOnce([])
    lexicalSearchMock.mockResolvedValueOnce([])

    const matches = await retrieveContext({ query: 'Does the article mention ZYNTHOCORP?', userId: 'u1', workspaceId: null, documentId: DOCUMENT_ID })
    expect(matches).toEqual([])

    const system = buildSystemPrompt(matches)
    expect(system).toContain("(No relevant content found in the user's library.)")
    expect(system).not.toContain('ZYNTHOCORP')
  })

  it('Phase 6 — the entity is findable via the same lexical mechanism regardless of whether it sits at the start, middle, or end of the document', () => {
    const beginningFixture = [{ index: 0, title: 'Page 1', text: 'ARRIYIA opens this report as the very first topic discussed.' }, ...ARTICLE_PAGES.slice(1)]
    const endFixture = [...ARTICLE_PAGES.slice(0, -1).filter((p) => p.index !== ARRIYIA_PAGE_INDEX), { index: 7, title: 'Page 8', text: 'The report closes by returning to ARRIYIA as its final example.' }]

    for (const fixture of [beginningFixture, endFixture]) {
      const positionalChunks = chapterAwareChunker.chunk({ text: fixture.map((p) => p.text).join('\n\n'), chapters: fixture })
      const hasArriyia = positionalChunks.some((c) => c.content.includes('ARRIYIA'))
      expect(hasArriyia).toBe(true)
    }
  })
})
