/**
 * PIP Reliability Sprint 2/10 — pulled out of useCommandActions.ts so the
 * URL-length safety property (only ever a conversation id + a note id,
 * never the note's title or content, however long either is) is directly
 * testable without rendering the whole hook stack. This is the one line
 * that makes createConversationWithNoteAnalysis safe for a "substantial
 * work" note where createConversationWithQuery's ?initialQuery= would not
 * be — see that action's own doc comment on CommandActions.
 */
export function buildNoteAnalysisConversationUrl(conversationId: string, noteId: string): string {
  return `/chat?conversationId=${encodeURIComponent(conversationId)}&initialNoteId=${encodeURIComponent(noteId)}`
}
