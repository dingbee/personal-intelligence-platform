-- AI Experience Intelligence v1 — the one genuinely new piece of
-- persistence this phase introduces. Every existing "informational"
-- intelligence surface (Hub's computeWorkspaceIntelligence IntelligenceItem
-- zones, the dashboard-scope Recommendation list from recommendationEngine.ts)
-- re-renders unchanged on every visit today; nothing lets a user say "I've
-- seen this, stop showing it." item_key is a stable string the caller
-- derives from whatever it's dismissing (IntelligenceItem.id, or
-- `${category}:${command.id}` for a Recommendation) — this table doesn't
-- know or care what kind of item it is, matching Recommendation/
-- IntelligenceItem's own "one shape, many producers" pattern.
create table public.dismissed_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  item_key text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, workspace_id, item_key)
);

create index dismissed_suggestions_user_workspace_idx on public.dismissed_suggestions (user_id, workspace_id);

alter table public.dismissed_suggestions enable row level security;

create policy "Users manage their own dismissed suggestions"
  on public.dismissed_suggestions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
