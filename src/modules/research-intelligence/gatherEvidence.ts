import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { retrieveNoteContext } from '@/modules/ai/orchestration/retrieveNoteContext'
import { fetchTitlesByIds } from '@/modules/knowledge-intelligence/api/sourceResolution'
import type { ResearchEvidence } from '@/modules/research-intelligence/researchInvestigation'

/** Caps total evidence per step so one query can't flood a step (and the downstream interpreter prompt) with low-relevance passages — same bounding rationale as retrieveContext's own MAX_LEXICAL_ONLY_ADDITIONS. */
const MAX_EVIDENCE_PER_STEP = 6
/** Excerpt length cap — evidence stays verbatim (never paraphrased), just truncated, so a very long chunk/note doesn't dominate the interpreter prompt. */
const MAX_EXCERPT_LENGTH = 600

function truncate(text: string): string {
  return text.length > MAX_EXCERPT_LENGTH ? `${text.slice(0, MAX_EXCERPT_LENGTH)}…` : text
}

/**
 * Research Intelligence's ONLY evidence-acquisition mechanism this
 * phase: real hybrid semantic+lexical retrieval over the caller's own
 * documents (retrieveContext) and notes (retrieveNoteContext) — both
 * already-proven, unmodified chat-grounding functions. No AI call
 * happens here; every ResearchEvidence item this function returns names
 * a real chunk/note id and carries its actual retrieved text. This is
 * the source-integrity boundary the P2 brief calls non-negotiable: an
 * LLM never gets to originate a "source" — it can only ever be handed a
 * search query, and gatherEvidence decides deterministically what came
 * back.
 *
 * There is no web/URL source retrieval anywhere in this codebase
 * (architecture audit) — this function is scoped to internal library
 * evidence only; external-source research is BACKLOG (see the final
 * report).
 */
export async function gatherEvidence(params: {
  query: string
  userId: string
  workspaceId: string | null
  documentId?: string | null
}): Promise<ResearchEvidence[]> {
  const { query, userId, workspaceId, documentId } = params

  const [documentMatches, noteMatches] = await Promise.all([
    retrieveContext({ query, userId, workspaceId, documentId: documentId ?? undefined }),
    retrieveNoteContext({ query, userId, workspaceId }),
  ])

  const documentIds = Array.from(new Set(documentMatches.map((m) => m.documentId)))
  const documentTitles = await fetchTitlesByIds('documents', documentIds)
  const titleByDocumentId = new Map(documentTitles.map((d) => [d.id, d.title]))

  const documentEvidence: ResearchEvidence[] = documentMatches.map((match) => ({
    id: match.chunkId,
    source: { type: 'document', id: match.documentId, title: titleByDocumentId.get(match.documentId) ?? 'Untitled document' },
    excerpt: truncate(match.content),
    similarity: match.similarity,
  }))

  const noteEvidence: ResearchEvidence[] = noteMatches.map((match) => ({
    id: match.noteId,
    source: { type: 'note', id: match.noteId, title: match.title },
    excerpt: truncate(match.content),
    similarity: match.similarity,
  }))

  return [...documentEvidence, ...noteEvidence].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, MAX_EVIDENCE_PER_STEP)
}
