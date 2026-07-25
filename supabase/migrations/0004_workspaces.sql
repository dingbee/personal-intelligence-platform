-- Milestone 3.5: platform architecture — Workspaces as the primary
-- organizational unit. Nullable workspace_id on existing tables keeps this
-- fully backward compatible: documents/collections with no workspace still
-- show up in the unscoped "All" view exactly as before.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add column workspace_id uuid references public.workspaces (id) on delete set null;

alter table public.collections
  add column workspace_id uuid references public.workspaces (id) on delete set null;

create index workspaces_user_id_idx on public.workspaces (user_id);
create index documents_workspace_id_idx on public.documents (workspace_id);
create index collections_workspace_id_idx on public.collections (workspace_id);

create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;

create policy "Users manage their own workspaces"
  on public.workspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
