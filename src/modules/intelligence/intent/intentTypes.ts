export type IntentType =
  | 'plan'
  | 'decide'
  | 'compare'
  | 'organize'
  | 'create'
  | 'summarize'
  | 'analyze'
  | 'review'
  | 'continue'
  | 'teach'
  | 'learn'
  | 'search'
  | 'read'
  | 'explain'
  | 'ask'

/** Which rule fired, kept for traceability in the Reasoning Trace and for direct unit testing of intentRules.ts. */
export interface IntentClassification {
  intent: IntentType
  confidence: number
  matchedRule: string
}
