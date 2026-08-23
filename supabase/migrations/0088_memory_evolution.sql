-- UX-14.2 Intelligence Memory Evolution — Reinforcement + Confidence Evolution.
--
-- Additive only, minimal state: two nullable-safe columns record what
-- genuinely needs persisting (how many times a memory has been confirmed
-- as a repeat, and when it was last reinforced). Everything else —
-- duplicate detection, the diminishing-return confidence bump, and
-- decay's effective-confidence-on-read — is pure application logic with
-- nothing else to persist:
--   - reinforcement_count defaults to 0 for every existing row (never
--     reinforced) and increments only when detectMemoryCandidates finds a
--     confirmed lexical repeat of an approved learned_preference/
--     conversation_memory (never explicit_profile — see
--     rememberMemoryCandidate.ts).
--   - last_reinforced_at stays null until the first reinforcement;
--     computeEffectiveConfidence.ts uses it (falling back to the existing
--     updated_at) as the decay reference, so a memory that's never been
--     reinforced decays from when it was created/last edited, exactly as
--     before this migration.
-- No RLS change needed: both columns are covered by the existing
-- "Users manage their own AI memory" policy (0010_reconcile_knowledge_
-- tables.sql), which already applies to every column via `for all`.
alter table public.ai_memory
  add column reinforcement_count integer not null default 0
    check (reinforcement_count >= 0),
  add column last_reinforced_at timestamptz;
