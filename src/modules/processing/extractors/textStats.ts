export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** Normalizes whitespace/line endings so downstream chunking sees clean text. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
