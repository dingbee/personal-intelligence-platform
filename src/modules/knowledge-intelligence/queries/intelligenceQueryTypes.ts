/**
 * Knowledge Intelligence Layer v1, Feature 5 — the five query shapes the
 * task's own examples name: "how has my thinking changed", "what
 * documents relate to this", "what am I missing", "what patterns do you
 * see", "what decisions have I made". Each maps directly onto a composer
 * that already exists (or was just added this phase) — this is a
 * classification layer over existing capability, not a new one.
 */
export type IntelligenceQueryType = 'evolution' | 'related_sources' | 'gaps' | 'patterns' | 'decisions'

export interface IntelligenceQueryClassification {
  type: IntelligenceQueryType
  confidence: number
  matchedRule: string
}
