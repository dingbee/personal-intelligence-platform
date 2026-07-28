-- Phase 8B.2: runtime provider enable/disable, per account. Additive only —
-- absence of a row (or enabled = null) means "no override", i.e. defer
-- entirely to the existing availability resolver (key-presence check).
-- `enabled = false` is the only state that actually excludes a provider;
-- `enabled = true` is an explicit "on" record distinct from "never touched"
-- but behaves identically to no-override for gating purposes.
--
-- No `priority` column: nothing reads it yet — ranking/fallback belongs to
-- the future Model Router phase, not this one. No `updated_by`: under
-- RLS (auth.uid() = user_id) it could only ever equal user_id itself.
create table public.provider_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null,
  enabled boolean,
  reason text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, provider_id)
);

create index provider_overrides_user_id_idx on public.provider_overrides (user_id);

alter table public.provider_overrides enable row level security;

create policy "Users manage their own provider overrides"
  on public.provider_overrides for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
