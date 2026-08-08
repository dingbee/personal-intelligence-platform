import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { supabaseVectorStore } from '@/modules/ai/retrieval/SupabaseVectorStore'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'
import { extractLexicalSearchTerms } from '@/modules/ai/orchestration/extractLexicalSearchTerms'
import { searchChunksByLexicalTerms } from '@/modules/ai/orchestration/lexicalChunkSearch'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

const embeddingProvider = new OpenAIEmbeddingProvider()
const SEMANTIC_MATCH_COUNT = 8
// PIP Sprint 4/10 — bounds how many extra chunks a literal-term match can
// contribute beyond the semantic top-K, so a common word extracted as a
// "term" can't flood the context with low-value matches.
const MAX_LEXICAL_ONLY_ADDITIONS = 4

/**
 * Embeds the user's query and finds the most relevant chunks — scoped to
 * one document, or the whole library. PIP Sprint 4/10 — also runs a
 * literal-term search (see extractLexicalSearchTerms.ts /
 * lexicalChunkSearch.ts) alongside the semantic one and merges the two,
 * the same hybrid semantic+lexical pattern documentSearchProvider.ts
 * already uses for Universal Search: a chunk found both ways gets
 * boosted, a chunk found only by literal term search (a rare proper noun
 * the embedding model didn't score highly) still gets included instead of
 * silently dropped, at a base score deliberately below a genuine semantic
 * match. Never throws on the lexical half — a failure there just means no
 * boost, not a broken chat turn (same contract every other optional
 * context source in this pipeline already follows).
 */
export async function retrieveContext(params: {
  query: string
  userId: string
  workspaceId: string | null
  documentId?: string
}): Promise<VectorMatch[]> {
  const [embedding] = await embeddingProvider.embed([params.query], {
    userId: params.userId,
    workspaceId: params.workspaceId,
    feature: 'retrieval',
  })
  // Only apply the workspace filter for whole-library chat — a
  // document-scoped conversation should always find that document's
  // chunks even if the workspace switcher has since moved elsewhere.
  const scope = { documentId: params.documentId, workspaceId: params.documentId ? undefined : params.workspaceId }

  const semanticMatches = await supabaseVectorStore.query(embedding!, { ...scope, matchCount: SEMANTIC_MATCH_COUNT })

  const lexicalTerms = extractLexicalSearchTerms(params.query)
  if (lexicalTerms.length === 0) return semanticMatches

  const lexicalMatches = await searchChunksByLexicalTerms(lexicalTerms, scope).catch(() => [])
  if (lexicalMatches.length === 0) return semanticMatches

  const lexicalChunkIds = new Set(lexicalMatches.map((m) => m.chunkId))
  const boosted = semanticMatches.map((match) =>
    lexicalChunkIds.has(match.chunkId) ? { ...match, similarity: applyLexicalBoost(match.similarity, true) } : match,
  )

  const semanticChunkIds = new Set(semanticMatches.map((m) => m.chunkId))
  const lexicalOnly: VectorMatch[] = lexicalMatches
    .filter((m) => !semanticChunkIds.has(m.chunkId))
    .slice(0, MAX_LEXICAL_ONLY_ADDITIONS)
    .map((m) => ({ chunkId: m.chunkId, documentId: m.documentId, content: m.content, similarity: LEXICAL_ONLY_BASE_SCORE }))

  return [...boosted, ...lexicalOnly].sort((a, b) => b.similarity - a.similarity)
}
