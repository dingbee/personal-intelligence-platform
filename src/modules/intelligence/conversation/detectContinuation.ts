const CONTINUATION_PATTERNS: RegExp[] = [
  /^continue\b/i,
  /^(keep|go) (going|on)\b/i,
  /^more\b/i,
  /^and then\b/i,
  /^what('?s| is) next\b/i,
  /^what about the rest\b/i,
  /^next\b/i,
]

/**
 * UX-6 Phase 5: detects a message that only makes sense in light of the
 * prior turn ("continue", "go on", "what's next") — a signal for the UI
 * (Phase 6's repeated/continuation signals) and for suggestion generation,
 * not a prompt rewrite. The conversation's actual history already reaches
 * the model unchanged via AIService's `history` param; this only flags the
 * *intent* so other parts of the system (signals, follow-ups) can react to it.
 */
export function isContinuationMessage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return CONTINUATION_PATTERNS.some((pattern) => pattern.test(trimmed))
}
