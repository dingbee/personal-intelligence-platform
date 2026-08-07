import type { AssetAnalysis } from '@/shared/types/database'

/**
 * Multimodal Intelligence v2 — Feature Area 6's "low confidence outputs
 * should request confirmation," grounded in the model's own self-reported
 * estimate (see analyzeImage.ts's CONFIDENCE: marker) rather than a
 * fabricated calibrated score. Below this threshold on any dimension, the
 * UI shows a "please review" banner instead of presenting the extraction
 * as settled fact.
 */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.5

export function needsConfidenceReview(confidence: AssetAnalysis['confidence']): boolean {
  if (!confidence) return false
  return [confidence.text, confidence.entities, confidence.relationships].some(
    (value) => value !== null && value < CONFIDENCE_REVIEW_THRESHOLD,
  )
}
