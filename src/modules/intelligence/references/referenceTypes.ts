export interface DocumentReference {
  type: 'document'
  id: string
  title: string
}

export interface ChapterReference {
  type: 'chapter'
  documentId: string
  documentTitle: string
  chapterIndex: number
  chapterTitle: string
}

export interface NoteReference {
  type: 'note'
  id: string
  title: string
}

export interface ConversationReference {
  type: 'conversation'
  id: string
  title: string
}

/**
 * UX-7 Phase 2: what the reference resolver understands. Only document/
 * chapter are actually produced from a chat answer today (see
 * referenceResolver.ts) — note/conversation exist as types because Phase 9's
 * timeline and future phases reference them via other, already-existing
 * data (recent notes, recent conversations), not because AIService
 * currently retrieves notes as part of answering a question.
 */
export type Reference = DocumentReference | ChapterReference | NoteReference | ConversationReference
