/**
 * Deterministic confidence rules (UX-5.3B section 2). Starts from a
 * pattern's base confidence (how durable/explicit the statement shape is —
 * see detectMemoryCandidates) and adjusts for linguistic signals in the
 * source text: questions and hypotheticals are not statements of fact at
 * all; hedging and temporary-task language describe something transient,
 * not a stable trait; strong/explicit markers reinforce that this is a
 * deliberate, durable statement.
 */
const HYPOTHETICAL_MARKERS = [/\bwhat if\b/i, /\bsuppose\b/i, /\bimagine if\b/i, /\bif i (?:were|had)\b/i, /\bhypothetically\b/i]
const HEDGE_MARKERS = [/\bmaybe\b/i, /\bmight\b/i, /\bperhaps\b/i, /\bcould be\b/i, /\bi guess\b/i, /\bnot sure\b/i]
const TEMPORARY_MARKERS = [
  /\btoday\b/i,
  /\bright now\b/i,
  /\bfor now\b/i,
  /\bremind me to\b/i,
  /\bthis week\b/i,
  /\btemporarily\b/i,
]
const STRONG_MARKERS = [/\balways\b/i, /\bnever\b/i, /\bdefinitely\b/i, /\bmy name is\b/i]

export function scoreMemoryConfidence(text: string, baseConfidence: number): number {
  let score = baseConfidence

  if (text.trim().endsWith('?')) score *= 0.3
  if (HYPOTHETICAL_MARKERS.some((marker) => marker.test(text))) score *= 0.5
  if (HEDGE_MARKERS.some((marker) => marker.test(text))) score *= 0.6
  if (TEMPORARY_MARKERS.some((marker) => marker.test(text))) score *= 0.6
  if (STRONG_MARKERS.some((marker) => marker.test(text))) score = Math.min(1, score + 0.05)

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
}

export type ConfidenceLabel = 'High' | 'Medium' | 'Low'

/** Formatting helper — what MemoryApprovalPanel's StatusBadge actually renders. */
export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}
