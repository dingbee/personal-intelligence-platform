import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'
import type { NoteContextMatch } from '@/modules/ai/orchestration/retrieveNoteContext'
import type { EvidenceReference } from '@/shared/provenance/types'

/**
 * Chat retrieval -> shared provenance adapter. Maps one retrieveContext
 * VectorMatch (a real, already-executed hybrid semantic+lexical chunk
 * match — this adapter performs no retrieval itself) into an
 * EvidenceReference. `documentTitle` must be supplied by the caller
 * (VectorMatch itself carries no title — the same title-lookup discipline
 * gatherEvidence.ts already applies via fetchTitlesByIds), so this
 * function never performs its own Supabase read. `retrievedAt` is the
 * current time: unlike a stored provenance record, a chat retrieval
 * match is inherently a "this just happened" fact, not a persisted one.
 *
 * `locationLabel` is optional (Multimodal Evidence Integration sprint,
 * closing a gap the multimodal-evidence-abstraction-audit identified):
 * the real page/chapter label resolveChunkProvenance.ts already computes
 * from document_chunks.chapter_title (e.g. "Page 4" for a PDF) can be
 * passed straight through into EvidenceLocation.chunk.label rather than
 * being discarded — additive only, never fabricated when the caller has
 * no label to supply.
 */
export function chunkMatchToEvidence(match: VectorMatch, documentTitle: string, locationLabel?: string): EvidenceReference {
  return {
    id: match.chunkId,
    source: { type: 'document', id: match.documentId, title: documentTitle },
    location: locationLabel ? { kind: 'chunk', chunkId: match.chunkId, label: locationLabel } : { kind: 'chunk', chunkId: match.chunkId },
    excerpt: match.content,
    retrievedAt: new Date().toISOString(),
  }
}

/** Same mapping for retrieveNoteContext's NoteContextMatch — a note has no chunk subdivision, so 'whole' is the honest location (mirrors gatherEvidence.ts's own note handling in Research Intelligence). */
export function noteMatchToEvidence(match: NoteContextMatch): EvidenceReference {
  return {
    id: match.noteId,
    source: { type: 'note', id: match.noteId, title: match.title },
    location: { kind: 'whole' },
    excerpt: match.content,
    retrievedAt: new Date().toISOString(),
  }
}
