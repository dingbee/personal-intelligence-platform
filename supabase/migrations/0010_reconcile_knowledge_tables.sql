-- Reconciliation migration (Knowledge Intelligence Phase 5, Task 2).
--
-- `notes`, `note_tags`, `knowledge_links`, and `ai_memory` already exist in
-- production but were never captured in this repo's migration history (see
-- docs/schema-reconciliation-report.md for the full live-vs-repo audit).
-- This migration describes their exact current production shape so a fresh
-- environment can reproduce it — it does not change production, since every
-- statement is guarded to no-op where the object already exists.
--
-- Safety: every CREATE is IF NOT EXISTS (tables, indexes) or wrapped in a
-- DO block checking catalog existence first (enum type, triggers, RLS
-- policies — none of which support IF NOT EXISTS natively in Postgres).
-- Nothing is dropped or altered. `notes` currently holds 2 real rows in
-- production; IF NOT EXISTS is what makes this safe to run against it.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_memory_type') then
    create type public.ai_memory_type as enum ('explicit_profile', 'learned_preference', 'conversation_memory');
  end if;
end $$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  collection_id uuid references public.collections (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  title text not null default 'Untitled note',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create table if not exists public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- source_id/target_id intentionally have no FK: source_type/target_type
  -- determine which table they point into, enforced by application code.
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id)
);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  memory_type public.ai_memory_type not null,
  content text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_workspace_id_idx on public.notes (workspace_id);
create index if not exists notes_collection_id_idx on public.notes (collection_id);
create index if not exists notes_document_id_idx on public.notes (document_id);
create index if not exists knowledge_links_source_idx on public.knowledge_links (source_type, source_id);
create index if not exists knowledge_links_target_idx on public.knowledge_links (target_type, target_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_notes_updated_at'
  ) then
    create trigger set_notes_updated_at
      before update on public.notes
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_ai_memory_updated_at'
  ) then
    create trigger set_ai_memory_updated_at
      before update on public.ai_memory
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.notes enable row level security;
alter table public.note_tags enable row level security;
alter table public.knowledge_links enable row level security;
alter table public.ai_memory enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'notes' and policyname = 'Users manage their own notes'
  ) then
    create policy "Users manage their own notes"
      on public.notes for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'note_tags' and policyname = 'Users manage tags on their own notes'
  ) then
    create policy "Users manage tags on their own notes"
      on public.note_tags for all
      using (
        exists (
          select 1 from public.notes
          where notes.id = note_tags.note_id
            and notes.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.notes
          where notes.id = note_tags.note_id
            and notes.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'knowledge_links' and policyname = 'Users manage their own knowledge links'
  ) then
    create policy "Users manage their own knowledge links"
      on public.knowledge_links for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'ai_memory' and policyname = 'Users manage their own AI memory'
  ) then
    create policy "Users manage their own AI memory"
      on public.ai_memory for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
