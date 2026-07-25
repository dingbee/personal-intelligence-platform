-- Milestone 5: universal semantic search across documents and
-- conversations, as a reusable platform capability (modules/search/) that
-- later knowledge sources (notes, highlights, flashcards) can plug into by
-- registering a SearchProvider — no schema or core code changes required
-- for a new source type in general, only its own embeddings table + RPC.

-- Denormalized from documents.workspace_id, same rationale as the existing
-- user_id column on this table: cheap to keep in sync at chunk-insert time,
-- avoids a join on every workspace-scoped search.
alter table public.document_chunks
  add column workspace_id uuid references public.workspaces (id) on delete set null;

create index document_chunks_workspace_id_idx on public.document_chunks (workspace_id);

-- Adding a parameter changes the function's identity in Postgres, so drop
-- the previous (vector, int, uuid, uuid) overload before recreating it with
-- workspace scoping.
drop function if exists public.match_document_chunks(vector(1536), int, uuid, uuid);

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

-- Messages get their own embeddings table rather than reusing `embeddings`
-- (which is keyed to document_chunks specifically) — keeps each source
-- type's indexing independent, which is the point of the SearchProvider
-- pattern: a new source type adds its own table + match function and
-- registers a provider, without touching this one.
create table public.message_embeddings (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index message_embeddings_embedding_idx on public.message_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.message_embeddings enable row level security;

create policy "Users manage embeddings on their own messages"
  on public.message_embeddings for all
  using (
    exists (
      select 1 from public.messages
      where messages.id = message_embeddings.message_id
        and messages.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messages
      where messages.id = message_embeddings.message_id
        and messages.user_id = auth.uid()
    )
  );

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
