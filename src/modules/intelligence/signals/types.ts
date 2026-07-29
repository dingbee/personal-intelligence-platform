export type SignalType =
  | 'reading_resumed'
  | 'knowledge_gap_detected'
  | 'repeated_topic_detected'
  | 'possible_note_creation'
  | 'related_concept_discovered'
  // UX-8 Phase 7 additions:
  | 'contradictory_memory'
  | 'reading_opportunity'
  | 'unreviewed_memory'
  | 'inactive_workspace'
  | 'large_context'
  | 'conversation_drift'
  // UX-9 Phase 6 additions (Reader):
  | 'knowledge_saturation'
  | 'review_recommended'
  | 'reading_gap'
  | 'chapter_completed'
  | 'book_nearly_finished'
  | 'high_highlight_density'
  | 'needs_summary'
  | 'strong_concept_cluster'
  // UX-10 Phase 6 additions (Knowledge Graph):
  | 'knowledge_island'
  | 'emerging_topic'
  | 'disconnected_concept'
  | 'rapid_growth'
  | 'high_confidence_cluster'
  | 'weak_evidence'
  | 'concept_drift'
  | 'duplicate_concept'

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
