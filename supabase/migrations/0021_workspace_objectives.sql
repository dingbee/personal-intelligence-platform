-- UX-13.7: Workspace Intelligence Hub — per-workspace objectives. A simple
-- user-authored checklist (content + status), not AI-generated and not
-- tracked against a due date yet; the Hub's "gaps"/"next actions" sections
-- stay purely derived from existing data, this is the one genuinely new
-- piece of state the Hub introduces.

create table public.workspace_objectives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  status text not null default 'active' check (status in ('active', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_objectives_workspace_id_idx on public.workspace_objectives (workspace_id);

create trigger set_workspace_objectives_updated_at
  before update on public.workspace_objectives
  for each row execute function public.set_updated_at();

alter table public.workspace_objectives enable row level security;

create policy "Users manage their own workspace objectives"
  on public.workspace_objectives for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
