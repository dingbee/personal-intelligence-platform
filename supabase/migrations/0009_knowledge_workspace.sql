-- Milestone 7: Knowledge Workspace — Notes, Knowledge Links (graph-ready
-- from the start, so the Knowledge Graph milestone doesn't need a data
-- model rework), and the foundation for a User Intelligence Profile.

-- === Part 1: Notes ===

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- Reuses the same collections tree documents already use, rather than a
  -- parallel "note collections" concept.
  collection_id uuid references public.collections (id) on delete set null,
  -- The document this note was primarily created from/attached to, if any
  -- (distinct from the many-to-many knowledge_links below — see README).
  document_id uuid references public.documents (id) on delete set null,
  title text not null default 'Untitled note',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index notes_user_id_idx on public.notes (user_id);
create index notes_workspace_id_idx on public.notes (workspace_id);
create index notes_collection_id_idx on public.notes (collection_id);
create index notes_document_id_idx on public.notes (document_id);

create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.note_tags enable row level security;

create policy "Users manage their own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage tags on their own notes"
  on public.note_tags for all
  using (
    exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
  );

-- === Part 2: Knowledge Links ===

-- Polymorphic and symmetric: a link is read from either side (queries
-- match on source OR target), so "Note <-> Document", "Note <-> Highlight",
-- etc. are all the same table and the same code path — a future
-- entity type just needs a LinkResolver, not a new links table.
create table public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id)
);

create index knowledge_links_source_idx on public.knowledge_links (source_type, source_id);
create index knowledge_links_target_idx on public.knowledge_links (target_type, target_id);

alter table public.knowledge_links enable row level security;

create policy "Users manage their own knowledge links"
  on public.knowledge_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- === Part 3: User Intelligence Profile ===

alter table public.profiles
  add column profession text,
  add column role text,
  add column industry text,
  add column organization text,
  add column bio text,
  add column expertise text[] not null default '{}',
  add column goals text[] not null default '{}',
  add column interests text[] not null default '{}',
  add column preferred_response_style text,
  add column preferred_detail_level text,
  add column preferred_language text,
  add column preferred_ai_provider text,
  add column preferred_reading_style text;

-- AI memory: schema-only foundation this milestone — nothing writes to it
-- automatically yet, by design. When something eventually does, this
-- distinction is load-bearing, not decorative:
--   explicit_profile     — what the user typed into their profile.
--   learned_preference   — inferred from behavior. Must always be
--                          reviewable, editable, and deletable by the
--                          user; the AI must never permanently infer
--                          personal facts without the user being able to
--                          see and correct them. This is a product/privacy
--                          requirement, not a naming convention, and it
--                          binds whoever implements the write path later.
--   conversation_memory  — longer-lived context carried across
--                          conversations, distinct from a single
--                          conversation's own message history.
create type ai_memory_type as enum ('explicit_profile', 'learned_preference', 'conversation_memory');

create table public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  memory_type ai_memory_type not null,
  content text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_ai_memory_updated_at
  before update on public.ai_memory
  for each row execute function public.set_updated_at();

alter table public.ai_memory enable row level security;

create policy "Users manage their own AI memory"
  on public.ai_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
