-- Reconciliation migration — brings a partially-migrated database up to
-- the schema Milestone 7's application code expects, without assuming
-- which of 0001-0009 actually applied.
--
-- Why this exists: live debugging confirmed `documents`, `collections`,
-- and `document_chunks` exist (0002/0003 applied), but `documents.workspace_id`
-- does not (PGRST204 on upload). That column is added in 0004_workspaces.sql,
-- in the same file that creates the `workspaces` table itself — Supabase
-- applies each migration file as one transaction, so if the column is
-- missing, 0004 did not apply at all, which means `workspaces` almost
-- certainly doesn't exist either. Every migration from 0005 onward depends
-- on `workspaces` (either a table with a FK to it, or a workspace_id column
-- referencing it), so the likely real state is: 0001-0003 applied, 0004-0009
-- did not.
--
-- This migration does not assume that inference is exactly right. Every
-- statement below is existence-checked (IF NOT EXISTS, or an equivalent
-- DO block / drop-then-create for object types that don't support it
-- natively), so it is safe to run against any partially-migrated state —
-- including a fully fresh database, or one where only some of 0004-0009
-- applied. Re-running this file is always a no-op past the first
-- successful run.
--
-- This intentionally does not replay 0001-0009 statement-by-statement.
-- It creates the *final* end state directly (e.g. match_document_chunks
-- is created once, in its final 5-argument form, rather than recreating
-- and re-dropping each historical overload in sequence).

begin;

-- === Extensions ===

create extension if not exists vector;

-- === Enums ===
-- create type has no native IF NOT EXISTS, so each is guarded with a
-- catalog check instead.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_file_type' and n.nspname = 'public'
  ) then
    create type public.document_file_type as enum ('pdf', 'epub', 'docx', 'txt', 'markdown');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_status' and n.nspname = 'public'
  ) then
    create type public.document_status as enum ('uploaded', 'processing', 'ready', 'error');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'processing_status' and n.nspname = 'public'
  ) then
    create type public.processing_status as enum ('queued', 'extracting', 'chunking', 'embedding', 'completed', 'failed');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'message_role' and n.nspname = 'public'
  ) then
    create type public.message_role as enum ('user', 'assistant', 'system');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_request_status' and n.nspname = 'public'
  ) then
    create type public.ai_request_status as enum ('success', 'error');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ai_memory_type' and n.nspname = 'public'
  ) then
    create type public.ai_memory_type as enum ('explicit_profile', 'learned_preference', 'conversation_memory');
  end if;
end $$;

-- === Core functions (needed by triggers created below) ===

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- === Tables (dependency order: profiles/workspaces before anything that
-- references them; each is created with its ORIGINAL column set only —
-- columns added by later migrations are added separately below, in the
-- "Columns added by later migrations" section, so both a fresh create and
-- an already-existing-but-behind table end up with every column) ===

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.collections (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  title text not null,
  file_name text not null,
  file_path text not null unique,
  file_type document_file_type not null,
  file_size bigint not null,
  status document_status not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.document_tags (
  document_id uuid not null references public.documents (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (document_id, tag_id)
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status processing_status not null default 'queued',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extraction_metadata (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  author text,
  language text,
  page_count int,
  chapter_count int,
  word_count int,
  char_count int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  char_start int not null,
  char_end int not null,
  token_count int not null,
  chapter_index int,
  chapter_title text,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.document_chunks (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  title text not null default 'New conversation',
  provider_id text not null default 'anthropic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role message_role not null,
  content text not null,
  context_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  feature text not null,
  provider text not null,
  model text,
  tokens_input int,
  tokens_output int,
  latency_ms int not null,
  status ai_request_status not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.message_embeddings (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_progress (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int not null default 0,
  scroll_fraction float not null default 0,
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int,
  quote text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapter_summaries (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int not null,
  content text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, chapter_index)
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_index int,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

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
  memory_type ai_memory_type not null,
  content text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === Columns added by later migrations, to tables that may already exist
-- from an earlier partial run ===

alter table public.documents
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

alter table public.collections
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

alter table public.document_chunks
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

alter table public.profiles
  add column if not exists profession text,
  add column if not exists role text,
  add column if not exists industry text,
  add column if not exists organization text,
  add column if not exists bio text,
  add column if not exists expertise text[] not null default '{}',
  add column if not exists goals text[] not null default '{}',
  add column if not exists interests text[] not null default '{}',
  add column if not exists preferred_response_style text,
  add column if not exists preferred_detail_level text,
  add column if not exists preferred_language text,
  add column if not exists preferred_ai_provider text,
  add column if not exists preferred_reading_style text;

-- === Indexes ===

create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_collection_id_idx on public.documents (collection_id);
create index if not exists documents_workspace_id_idx on public.documents (workspace_id);
create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_parent_id_idx on public.collections (parent_id);
create index if not exists collections_workspace_id_idx on public.collections (workspace_id);
create index if not exists document_tags_tag_id_idx on public.document_tags (tag_id);
create index if not exists processing_jobs_document_id_idx on public.processing_jobs (document_id);
create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_user_id_idx on public.document_chunks (user_id);
create index if not exists document_chunks_workspace_id_idx on public.document_chunks (workspace_id);
create index if not exists embeddings_embedding_idx on public.embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists workspaces_user_id_idx on public.workspaces (user_id);
create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists conversations_workspace_id_idx on public.conversations (workspace_id);
create index if not exists conversations_document_id_idx on public.conversations (document_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists ai_requests_user_id_idx on public.ai_requests (user_id);
create index if not exists ai_requests_created_at_idx on public.ai_requests (created_at desc);
create index if not exists message_embeddings_embedding_idx on public.message_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists highlights_document_id_idx on public.highlights (document_id);
create index if not exists flashcards_document_id_idx on public.flashcards (document_id);
create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_workspace_id_idx on public.notes (workspace_id);
create index if not exists notes_collection_id_idx on public.notes (collection_id);
create index if not exists notes_document_id_idx on public.notes (document_id);
create index if not exists knowledge_links_source_idx on public.knowledge_links (source_type, source_id);
create index if not exists knowledge_links_target_idx on public.knowledge_links (target_type, target_id);

-- === Triggers ===
-- create trigger has no native IF NOT EXISTS; drop-then-create is the
-- standard idempotent pattern and is safe to repeat.

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists set_processing_jobs_updated_at on public.processing_jobs;
create trigger set_processing_jobs_updated_at before update on public.processing_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists set_extraction_metadata_updated_at on public.extraction_metadata;
create trigger set_extraction_metadata_updated_at before update on public.extraction_metadata
  for each row execute function public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists set_highlights_updated_at on public.highlights;
create trigger set_highlights_updated_at before update on public.highlights
  for each row execute function public.set_updated_at();

drop trigger if exists set_reading_progress_updated_at on public.reading_progress;
create trigger set_reading_progress_updated_at before update on public.reading_progress
  for each row execute function public.set_updated_at();

drop trigger if exists set_chapter_summaries_updated_at on public.chapter_summaries;
create trigger set_chapter_summaries_updated_at before update on public.chapter_summaries
  for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

drop trigger if exists set_ai_memory_updated_at on public.ai_memory;
create trigger set_ai_memory_updated_at before update on public.ai_memory
  for each row execute function public.set_updated_at();

-- === Row level security: enable (idempotent by nature) + policies
-- (drop-then-create, since CREATE POLICY has no IF NOT EXISTS either) ===

alter table public.profiles enable row level security;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

alter table public.workspaces enable row level security;
drop policy if exists "Users manage their own workspaces" on public.workspaces;
create policy "Users manage their own workspaces" on public.workspaces for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.collections enable row level security;
drop policy if exists "Users manage their own collections" on public.collections;
create policy "Users manage their own collections" on public.collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.documents enable row level security;
drop policy if exists "Users manage their own documents" on public.documents;
create policy "Users manage their own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.tags enable row level security;
drop policy if exists "Users manage their own tags" on public.tags;
create policy "Users manage their own tags" on public.tags for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.document_tags enable row level security;
drop policy if exists "Users manage tags on their own documents" on public.document_tags;
create policy "Users manage tags on their own documents" on public.document_tags for all
  using (exists (select 1 from public.documents where documents.id = document_tags.document_id and documents.user_id = auth.uid()))
  with check (exists (select 1 from public.documents where documents.id = document_tags.document_id and documents.user_id = auth.uid()));

alter table public.processing_jobs enable row level security;
drop policy if exists "Users manage their own processing jobs" on public.processing_jobs;
create policy "Users manage their own processing jobs" on public.processing_jobs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.extraction_metadata enable row level security;
drop policy if exists "Users manage their own extraction metadata" on public.extraction_metadata;
create policy "Users manage their own extraction metadata" on public.extraction_metadata for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.document_chunks enable row level security;
drop policy if exists "Users manage their own document chunks" on public.document_chunks;
create policy "Users manage their own document chunks" on public.document_chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.embeddings enable row level security;
drop policy if exists "Users manage embeddings on their own chunks" on public.embeddings;
create policy "Users manage embeddings on their own chunks" on public.embeddings for all
  using (exists (select 1 from public.document_chunks where document_chunks.id = embeddings.chunk_id and document_chunks.user_id = auth.uid()))
  with check (exists (select 1 from public.document_chunks where document_chunks.id = embeddings.chunk_id and document_chunks.user_id = auth.uid()));

alter table public.conversations enable row level security;
drop policy if exists "Users manage their own conversations" on public.conversations;
create policy "Users manage their own conversations" on public.conversations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.messages enable row level security;
drop policy if exists "Users manage their own messages" on public.messages;
create policy "Users manage their own messages" on public.messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.message_embeddings enable row level security;
drop policy if exists "Users manage embeddings on their own messages" on public.message_embeddings;
create policy "Users manage embeddings on their own messages" on public.message_embeddings for all
  using (exists (select 1 from public.messages where messages.id = message_embeddings.message_id and messages.user_id = auth.uid()))
  with check (exists (select 1 from public.messages where messages.id = message_embeddings.message_id and messages.user_id = auth.uid()));

alter table public.ai_requests enable row level security;
drop policy if exists "Users view their own AI requests" on public.ai_requests;
create policy "Users view their own AI requests" on public.ai_requests for select using (auth.uid() = user_id);
drop policy if exists "Users insert their own AI requests" on public.ai_requests;
create policy "Users insert their own AI requests" on public.ai_requests for insert with check (auth.uid() = user_id);

alter table public.reading_progress enable row level security;
drop policy if exists "Users manage their own reading progress" on public.reading_progress;
create policy "Users manage their own reading progress" on public.reading_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.highlights enable row level security;
drop policy if exists "Users manage their own highlights" on public.highlights;
create policy "Users manage their own highlights" on public.highlights for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.chapter_summaries enable row level security;
drop policy if exists "Users manage their own chapter summaries" on public.chapter_summaries;
create policy "Users manage their own chapter summaries" on public.chapter_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.flashcards enable row level security;
drop policy if exists "Users manage their own flashcards" on public.flashcards;
create policy "Users manage their own flashcards" on public.flashcards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.notes enable row level security;
drop policy if exists "Users manage their own notes" on public.notes;
create policy "Users manage their own notes" on public.notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.note_tags enable row level security;
drop policy if exists "Users manage tags on their own notes" on public.note_tags;
create policy "Users manage tags on their own notes" on public.note_tags for all
  using (exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid()))
  with check (exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid()));

alter table public.knowledge_links enable row level security;
drop policy if exists "Users manage their own knowledge links" on public.knowledge_links;
create policy "Users manage their own knowledge links" on public.knowledge_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.ai_memory enable row level security;
drop policy if exists "Users manage their own AI memory" on public.ai_memory;
create policy "Users manage their own AI memory" on public.ai_memory for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === RPC functions (created last: their bodies reference the tables
-- above, so those must already exist) ===

-- Drop every historical overload by exact signature — CREATE OR REPLACE
-- can't change a function's argument list, and Postgres treats a
-- different signature as a distinct, separately-overloaded function
-- rather than an error, so leaving old overloads in place would work
-- but silently clutter the catalog. Cheap to clean up explicitly.
drop function if exists public.match_document_chunks(vector(1536), int, uuid);
drop function if exists public.match_document_chunks(vector(1536), int, uuid, uuid);
drop function if exists public.match_document_chunks(vector(1536), int, uuid, uuid, uuid);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid(),
  filter_document_id uuid default null,
  filter_workspace_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id as chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from public.embeddings
  join public.document_chunks on document_chunks.id = embeddings.chunk_id
  where document_chunks.user_id = filter_user_id
    and (filter_document_id is null or document_chunks.document_id = filter_document_id)
    and (filter_workspace_id is null or document_chunks.workspace_id = filter_workspace_id)
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_messages(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid(),
  filter_workspace_id uuid default null
)
returns table (
  message_id uuid,
  conversation_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    messages.id as message_id,
    messages.conversation_id,
    messages.content,
    1 - (message_embeddings.embedding <=> query_embedding) as similarity
  from public.message_embeddings
  join public.messages on messages.id = message_embeddings.message_id
  join public.conversations on conversations.id = messages.conversation_id
  where messages.user_id = filter_user_id
    and (filter_workspace_id is null or conversations.workspace_id = filter_workspace_id)
  order by message_embeddings.embedding <=> query_embedding
  limit match_count;
$$;

-- === Storage: bucket + policy ===

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own files in the documents bucket" on storage.objects;
create policy "Users manage their own files in the documents bucket"
  on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
