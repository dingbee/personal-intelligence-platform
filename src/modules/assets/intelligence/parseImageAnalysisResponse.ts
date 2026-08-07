/**
 * Multimodal Intelligence v1 — pure parser for the analyze-image prompt's
 * response shape (see ANALYZE_IMAGE_SYSTEM_PROMPT in analyzeImage.ts): a
 * free-text description, then a line starting with "TEXT:" carrying any
 * visible text verbatim, or "(none)" when there isn't any. Kept separate
 * from the network call so the parsing logic itself is unit-testable
 * without mocking a provider.
 */
export function parseImageAnalysisResponse(raw: string): { description: string; extractedText: string | null } {
  const lines = raw.trim().split('\n')
  const textLineIndex = lines.findIndex((line) => /^TEXT:/i.test(line.trim()))

  if (textLineIndex === -1) {
    return { description: raw.trim(), extractedText: null }
  }

  const description = lines.slice(0, textLineIndex).join('\n').trim()
  const textValue = lines
    .slice(textLineIndex)
    .join('\n')
    .trim()
    .replace(/^TEXT:/i, '')
    .trim()

  const extractedText = textValue.length === 0 || /^\(none\)$/i.test(textValue) ? null : textValue
  return { description: description || raw.trim(), extractedText }
}
