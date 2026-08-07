import type { IntelligenceQueryClassification, IntelligenceQueryType } from '@/modules/knowledge-intelligence/queries/intelligenceQueryTypes'

interface IntelligenceQueryRule {
  id: string
  type: IntelligenceQueryType
  patterns: RegExp[]
}

/**
 * Same deterministic, no-AI-call convention as intentRules.ts — order is
 * significant, most specific first, so a query mentioning "documents" and
 * "decisions" together resolves to the more specific 'decisions' rather
 * than being shadowed by the generic 'related_sources' catch-all.
 */
const INTELLIGENCE_QUERY_RULES: IntelligenceQueryRule[] = [
  {
    id: 'evolution',
    type: 'evolution',
    patterns: [/\bhow (has|have) my thinking\b/i, /\bhow (has|have) this (changed|evolved)\b/i, /\bevolv(e|ed|ing|ution)\b/i, /\bover time\b/i, /\bprogress(ed|ion)?\b/i],
  },
  {
    id: 'gaps',
    type: 'gaps',
    patterns: [/\bwhat.*am i missing\b/i, /\bwhat.*missing\b/i, /\bwhat.*gaps?\b/i, /\bwhat should i (add|cover|research)\b/i],
  },
  {
    id: 'patterns',
    type: 'patterns',
    patterns: [/\bwhat patterns\b/i, /\bwhat trends\b/i, /\bwhat (do you|does nova) (notice|see)\b/i],
  },
  {
    id: 'decisions',
    type: 'decisions',
    patterns: [/\bdecisions?\b/i, /\bwhat did i decide\b/i, /\bwhat have i decided\b/i],
  },
  {
    id: 'related_sources',
    type: 'related_sources',
    patterns: [/\brelate[sd]?\b/i, /\bconnected? to\b/i, /\bwhich (documents|notes|sources|images|conversations)\b/i, /\bwhat documents\b/i],
  },
]

const FALLBACK_QUERY_TYPE: IntelligenceQueryType = 'related_sources'
const RULE_MATCH_CONFIDENCE = 0.8
const FALLBACK_CONFIDENCE = 0.4

export function classifyIntelligenceQuery(text: string): IntelligenceQueryClassification {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { type: FALLBACK_QUERY_TYPE, confidence: 0, matchedRule: 'empty-input' }
  }

  for (const rule of INTELLIGENCE_QUERY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(trimmed))) {
      return { type: rule.type, confidence: RULE_MATCH_CONFIDENCE, matchedRule: rule.id }
    }
  }

  return { type: FALLBACK_QUERY_TYPE, confidence: FALLBACK_CONFIDENCE, matchedRule: 'fallback-related-sources' }
}
