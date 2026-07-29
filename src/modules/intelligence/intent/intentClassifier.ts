import { FALLBACK_INTENT, INTENT_RULES } from '@/modules/intelligence/intent/intentRules'
import type { IntentClassification } from '@/modules/intelligence/intent/intentTypes'

const RULE_MATCH_CONFIDENCE = 0.8
const FALLBACK_CONFIDENCE = 0.4

/**
 * UX-12 Phase 2 — the Intent Intelligence classifier. Fully deterministic:
 * no AI provider call, no embedding, no network I/O. Tries INTENT_RULES in
 * order and returns the first match; an empty or unmatched message falls
 * back to 'ask' at lower confidence rather than guessing.
 */
export function classifyIntent(text: string): IntentClassification {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { intent: FALLBACK_INTENT, confidence: 0, matchedRule: 'empty-input' }
  }

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return { intent: rule.intent, confidence: RULE_MATCH_CONFIDENCE, matchedRule: rule.id }
    }
  }

  return { intent: FALLBACK_INTENT, confidence: FALLBACK_CONFIDENCE, matchedRule: 'fallback-ask' }
}
