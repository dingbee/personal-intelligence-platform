-- Phase 8B: per-user default chat provider. Nullable so existing rows (and
-- the app's own fallback logic) keep working unchanged when unset — the
-- hardcoded DEFAULT_CHAT_PROVIDER_ID constant remains the fallback of last
-- resort. No RLS changes needed: existing profiles policies already cover
-- every column.
alter table public.profiles
  add column default_chat_provider_id text;
