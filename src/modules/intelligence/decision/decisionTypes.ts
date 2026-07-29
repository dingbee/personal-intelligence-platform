export type DecisionConfidence = 'low' | 'medium' | 'high'

export interface DecisionOption {
  label: string
}

export interface DecisionFramework {
  options: DecisionOption[]
  pros: string[]
  cons: string[]
  risks: string[]
  recommendation: string | null
  confidence: DecisionConfidence
}
