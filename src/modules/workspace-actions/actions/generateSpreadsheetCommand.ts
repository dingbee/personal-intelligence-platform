/**
 * UX-14.4.2 — pure, deterministic recognition of "create a spreadsheet for
 * X" and its variants, same reasoning and anchoring discipline as
 * `parseExecutiveBriefingCommand`/`isSaveToNotesCommand`: no LLM call
 * spent deciding the user asked for a spreadsheet. The *content* of the
 * spreadsheet is the LLM's job (via the `generate-spreadsheet-artifact`
 * capability); recognizing the request is not.
 */
const COMMAND_PATTERN =
  /^(?:create|generate|build|make)\s+(?:an?\s+)?(?:spreadsheet|model|template|table)\s+(?:for|about|of|on)\s+(.+?)[.!?]*$/i

export interface GenerateSpreadsheetCommand {
  request: string
}

export function parseGenerateSpreadsheetCommand(text: string): GenerateSpreadsheetCommand | null {
  const match = text.trim().match(COMMAND_PATTERN)
  const captured = match?.[1]
  if (!captured) return null
  const request = captured.trim()
  if (!request) return null
  return { request }
}
