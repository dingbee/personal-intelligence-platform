export type TitleSource = 'ai' | 'fallback'

export interface TitleConfidenceInput {
  source: TitleSource
  wordCount: number
}

const AI_BASE_CONFIDENCE = 0.85
const FALLBACK_BASE_CONFIDENCE = 0.5
const SHORT_TITLE_PENALTY = 0.15
const IDEAL_MIN_WORDS = 3
const IDEAL_MAX_WORDS = 6

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * UX-13.5A — deterministic confidence score for a finalized title. The AI
 * capability path scores higher than the keyword-fallback path (an intent-
 * capturing paraphrase is inherently more trustworthy than a keyword
 * extraction), and titles shorter than the ideal 3-6 word range lose
 * confidence either way — a 1-2 word title is more likely to be a
 * near-miss than a good title.
 */
export function computeTitleConfidence(input: TitleConfidenceInput): number {
  const base = input.source === 'ai' ? AI_BASE_CONFIDENCE : FALLBACK_BASE_CONFIDENCE
  const isShort = input.wordCount < IDEAL_MIN_WORDS
  const isOverLong = input.wordCount > IDEAL_MAX_WORDS
  const penalty = isShort || isOverLong ? SHORT_TITLE_PENALTY : 0
  return clamp(base - penalty)
}
