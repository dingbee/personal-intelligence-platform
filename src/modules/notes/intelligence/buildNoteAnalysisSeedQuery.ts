/**
 * PIP Multimodal Intelligence Stabilization v1 — Problem 3. "Ask NOVA about
 * this note" used to seed a new conversation with only
 * `I'd like to talk about a note called "${note.title}"` — the note's
 * actual content never reached the model, so any analysis NOVA gave was
 * either an honest "I don't have that" or a guess from the title alone.
 * This carries the real content into the very first user turn, the same
 * "don't depend on retrieval accidentally finding it" fix
 * buildImageChatSeedQuery.ts already applied to images — reusing the exact
 * same chat pipeline (createConversationWithQuery's send path), not a
 * second analysis engine.
 */
export function buildNoteAnalysisSeedQuery(title: string, content: string): string {
  const trimmed = content.trim()
  if (!trimmed) {
    return `Please analyze my note titled "${title}". It's currently empty — let me know once I've added some content.`
  }
  return `Please analyze this note titled "${title}":\n\n${trimmed}\n\nSummarize the main ideas, and separately identify any decisions, dates, tasks, priorities, and notable people mentioned — keep each category distinct rather than blending them into one summary.`
}
