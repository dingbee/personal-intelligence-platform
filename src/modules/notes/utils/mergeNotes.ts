export interface MergeableNote {
  title: string
  content: string
}

/**
 * Knowledge Actions v1 — Merge Notes. Deterministic, no AI: each note
 * becomes a heading + its content, joined with a horizontal-rule
 * separator so the merge is legible and reversible-by-reading (nothing
 * is summarized away). Empty-content notes still contribute their
 * heading, since a note with only a title is still meaningful evidence
 * of what was merged.
 */
export function buildMergedNoteContent(notes: MergeableNote[]): string {
  return notes.map((note) => `## ${note.title}\n\n${note.content}`.trim()).join('\n\n---\n\n')
}

export function buildMergedNoteTitle(notes: MergeableNote[]): string {
  return `Merged: ${notes.map((note) => note.title).join(' + ')}`
}
