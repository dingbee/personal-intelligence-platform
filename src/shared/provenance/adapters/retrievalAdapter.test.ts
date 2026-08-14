import { describe, expect, it } from 'vitest'
import { chunkMatchToEvidence, noteMatchToEvidence } from '@/shared/provenance/adapters/retrievalAdapter'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'
import type { NoteContextMatch } from '@/modules/ai/orchestration/retrieveNoteContext'

describe('chunkMatchToEvidence', () => {
  it('preserves the real chunk id, document id, and verbatim content', () => {
    const match: VectorMatch = { chunkId: 'chunk-1', documentId: 'doc-1', content: 'Returns must be processed within 30 days.', similarity: 0.91 }
    const evidence = chunkMatchToEvidence(match, 'Returns Policy')
    expect(evidence.id).toBe('chunk-1')
    expect(evidence.source).toEqual({ type: 'document', id: 'doc-1', title: 'Returns Policy' })
    expect(evidence.location).toEqual({ kind: 'chunk', chunkId: 'chunk-1' })
    expect(evidence.excerpt).toBe('Returns must be processed within 30 days.')
  })
})

describe('noteMatchToEvidence', () => {
  it('maps a note match with a whole-source location, since notes have no chunk subdivision', () => {
    const match: NoteContextMatch = { noteId: 'note-1', title: 'Ops notes', content: 'South region flagged.', similarity: 0.7 }
    const evidence = noteMatchToEvidence(match)
    expect(evidence.source).toEqual({ type: 'note', id: 'note-1', title: 'Ops notes' })
    expect(evidence.location).toEqual({ kind: 'whole' })
    expect(evidence.excerpt).toBe('South region flagged.')
  })
})
