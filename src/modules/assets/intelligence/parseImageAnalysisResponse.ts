/**
 * Multimodal Intelligence v1/v2 — pure parser for the analyze-image
 * prompt's response shape (see ANALYZE_IMAGE_SYSTEM_PROMPT in
 * analyzeImage.ts): a free-text description, followed by marker lines
 * (TEXT:/LANGUAGE:/CONFIDENCE:, each optional) whose content runs until
 * the next marker or end of response. Kept separate from the network
 * call so the parsing logic itself is unit-testable without mocking a
 * provider.
 */

export interface ParsedImageAnalysis {
  description: string
  extractedText: string | null
  /** Self-reported by the model, not a dedicated language-ID library — a best-effort label, not a certainty. */
  detectedLanguage: string | null
  /** The model's own self-assessment, not a calibrated statistical confidence — see docs/multimodal-intelligence-v2-discovery.md §5. */
  confidence: { text: number | null; entities: number | null; relationships: number | null } | null
}

const MARKER_KEYS = ['TEXT', 'LANGUAGE', 'CONFIDENCE'] as const
type MarkerKey = (typeof MARKER_KEYS)[number]
const MARKER_LINE_RE = /^(TEXT|LANGUAGE|CONFIDENCE):/i
const MARKER_CAPTURE_RE = /^(TEXT|LANGUAGE|CONFIDENCE):\s*(.*)$/i

function parseConfidenceValue(raw: string): ParsedImageAnalysis['confidence'] {
  const fields: Partial<Record<'text' | 'entities' | 'relationships', number>> = {}
  for (const part of raw.split(',')) {
    const match = part.trim().match(/^(text|entities|relationships)\s*=\s*([0-9.]+)$/i)
    if (!match) continue
    const value = Number(match[2])
    if (Number.isNaN(value)) continue
    fields[match[1]!.toLowerCase() as 'text' | 'entities' | 'relationships'] = Math.min(1, Math.max(0, value))
  }
  if (Object.keys(fields).length === 0) return null
  return { text: fields.text ?? null, entities: fields.entities ?? null, relationships: fields.relationships ?? null }
}

export function parseImageAnalysisResponse(raw: string): ParsedImageAnalysis {
  const lines = raw.trim().split('\n')
  const firstMarkerIndex = lines.findIndex((line) => MARKER_LINE_RE.test(line.trim()))

  if (firstMarkerIndex === -1) {
    return { description: raw.trim(), extractedText: null, detectedLanguage: null, confidence: null }
  }

  const description = lines.slice(0, firstMarkerIndex).join('\n').trim() || raw.trim()

  const sections: Record<MarkerKey, string[]> = { TEXT: [], LANGUAGE: [], CONFIDENCE: [] }
  let currentKey: MarkerKey | null = null
  for (const line of lines.slice(firstMarkerIndex)) {
    const match = line.trim().match(MARKER_CAPTURE_RE)
    if (match) {
      currentKey = match[1]!.toUpperCase() as MarkerKey
      if (match[2]) sections[currentKey].push(match[2])
    } else if (currentKey) {
      sections[currentKey].push(line)
    }
  }

  const textValue = sections.TEXT.join('\n').trim()
  const extractedText = textValue.length === 0 || /^\(none\)$/i.test(textValue) ? null : textValue

  const languageValue = sections.LANGUAGE.join(' ').trim()
  const detectedLanguage = languageValue.length === 0 || /^none$/i.test(languageValue) ? null : languageValue

  const confidence = parseConfidenceValue(sections.CONFIDENCE.join(' '))

  return { description, extractedText, detectedLanguage, confidence }
}
