-- Multimodal Intelligence v1 — the one gap discovery found in the assets
-- table: unlike extraction_metadata (which has a jsonb metadata column for
-- exactly this kind of type-specific data), assets had nowhere to honestly
-- persist AI-generated image analysis. Nullable, additive: every existing
-- asset row is correctly represented as "not yet analyzed" rather than
-- backfilled with a fabricated value.
alter table public.assets add column metadata jsonb;
