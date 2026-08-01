/**
 * AI Workspace Actions v1 — pure, deterministic recognition of "save this"
 * and its variants, same reasoning as parseExecutiveBriefingCommand: no
 * LLM call spent classifying intent. Whole-message match (anchored, not a
 * substring search) so an ordinary sentence that happens to contain these
 * words ("Can you save this for later?") isn't misfired as a command —
 * same anchoring discipline the executive-briefing pattern already uses.
 */
const SAVE_COMMAND_PATTERN = /^(?:save this|remember this|capture this|add this to my notes)[.!]*$/i

export function isSaveToNotesCommand(text: string): boolean {
  return SAVE_COMMAND_PATTERN.test(text.trim())
}
