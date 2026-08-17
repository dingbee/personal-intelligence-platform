const CONTINUATION_PATTERNS: RegExp[] = [
  /^continue\b/i,
  /^(keep|go) (going|on)\b/i,
  // Retrieval Prerequisite Fix — tightened from /^more\b/i to a full-line
  // anchor: the old prefix match also fired on "more information about
  // Tanzania" (a new, substantive question), not just bare "more"/"more?".
  /^more\??$/i,
  /^and then\b/i,
  /^what('?s| is) next\b/i,
  /^what about the rest\b/i,
  // Retrieval Prerequisite Fix — same tightening as `more` above: the old
  // /^next\b/i prefix match also fired on "next chapter please".
  /^next\??$/i,
  // Retrieval Prerequisite Fix — short conversational follow-ups that only
  // make sense in light of the prior turn. Anchored to the *entire*
  // (trimmed) message, not just a prefix, so a substantive question that
  // happens to start with the same word is never misclassified — e.g.
  // "why is Tanzania different from Kenya?" and "how do I upload a
  // document?" don't match, only bare "why?"/"how?" do.
  /^why\??$/i,
  /^how\??$/i,
  /^what about that\??$/i,
  /^and\??$/i,
  // Bare agreement ("yes"/"yes.") reads as continuing the prior thread.
  // Deliberately NOT a prefix match — "yes, create a note" names a new,
  // specific action and must not be swept in here.
  /^yes\.?$/i,
  /^yes,? exactly\.?$/i,
]

/**
 * UX-6 Phase 5: detects a message that only makes sense in light of the
 * prior turn ("continue", "go on", "what's next") — a signal for the UI
 * (Phase 6's repeated/continuation signals) and for suggestion generation,
 * not a prompt rewrite. The conversation's actual history already reaches
 * the model unchanged via AIService's `history` param; this only flags the
 * *intent* so other parts of the system (signals, follow-ups) can react to
 * it — and, as of the Retrieval Prerequisite Fix, so planner.ts can
 * broaden `requiredContext` for a confirmed continuation turn.
 *
 * Every pattern here is a full-line (or definite-prefix-phrase) match
 * against the trimmed message, never a bare keyword-anywhere-in-the-text
 * search — deliberately conservative so a real, substantive question that
 * happens to start with "why"/"how"/"more"/"next" is never misclassified
 * as a content-free follow-up (see the tightened `more`/`next` patterns
 * and the new `why`/`how`/`what about that`/`and`/`yes` patterns above).
 */
export function isContinuationMessage(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return CONTINUATION_PATTERNS.some((pattern) => pattern.test(trimmed))
}
