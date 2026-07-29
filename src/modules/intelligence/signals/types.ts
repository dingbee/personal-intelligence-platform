export type SignalType =
  | 'reading_resumed'
  | 'knowledge_gap_detected'
  | 'repeated_topic_detected'
  | 'possible_note_creation'
  | 'related_concept_discovered'

/**
 * UX-6 Phase 6: informational only. Nothing reads a signal and acts on it
 * automatically — no notifications, no background jobs, no auto-created
 * notes/memories. Signals exist so a future UI can surface "NOVA noticed
 * X" without inventing a new detection mechanism per feature.
 */
export interface IntelligenceSignal {
  type: SignalType
  message: string
}
