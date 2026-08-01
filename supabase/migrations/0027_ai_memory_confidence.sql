-- UX-14.3 Memory Intelligence Phase 1 (Confidence Persistence)
-- scoreMemoryConfidence() has always computed a 0..1 confidence score at
-- candidate-detection time, but MemoryManagementPage.tsx's rememberCandidate
-- never passed it into createMemory() -- calculated, used once for the
-- approval-panel badge and the MIN_CONFIDENCE filter, then discarded.
-- Additive only, nullable: every existing row, and every future
-- manually-authored memory/profile field (not an inference, so a
-- confidence score is a category error for those), is honestly
-- represented as "not scored" rather than backfilled with a fabricated
-- default.
alter table public.ai_memory
  add column confidence numeric
  check (confidence is null or (confidence >= 0 and confidence <= 1));
