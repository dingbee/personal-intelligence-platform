/**
 * AI Workspace Actions v1 — pure, deterministic recognition of "save this"
 * and its variants, same reasoning as parseExecutiveBriefingCommand: no
 * LLM call spent classifying intent. Whole-message match (anchored, not a
 * substring search) so an ordinary sentence that happens to contain these
 * words ("Can you save this for later?") isn't misfired as a command —
 * same anchoring discipline the executive-briefing pattern already uses.
 *
 * Reliability & Truth Audit — real production transcripts (queried
 * directly from the live database) showed the v1 exact-phrase-only
 * pattern missing how people actually type this: a polite "can/could/
 * would you (please) ..." lead-in, and a trailing "to notes"/"to my
 * notes"/"in my notes" that doesn't change the intent. Widened to cover
 * both, still anchored (whole-message only) so "Can you save this for
 * later?" and "Save this document to my library." — real negative cases
 * from the same transcripts — still fall through to normal chat.
 */
const SAVE_COMMAND_PATTERN =
  /^(?:(?:can|could|would) you\s+|please\s+)*(?:(?:save|remember|capture|memorize|memorise) this(?:\s+(?:to|in)\s+(?:my\s+)?notes)?|add this to my notes)[.!?]*$/i

export function isSaveToNotesCommand(text: string): boolean {
  return SAVE_COMMAND_PATTERN.test(text.trim())
}
