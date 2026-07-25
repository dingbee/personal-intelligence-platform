-- Milestone 4: AI chat with RAG.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  title text not null default 'New conversation',
  provider_id text not null default 'anthropic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type message_role as enum ('user', 'assistant', 'system');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role message_role not null,
  content text not null,
  -- Chunk ids retrieved and included as context for this (assistant) message,
  -- so the UI can show "Sources" without re-running retrieval.
  context_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index conversations_user_id_idx on public.conversations (user_id);
create index conversations_workspace_id_idx on public.conversations (workspace_id);
create index conversations_document_id_idx on public.conversations (document_id);
create index messages_conversation_id_idx on public.messages (conversation_id);

create trigger set_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users manage their own conversations"
  on public.conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own messages"
  on public.messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Extends the Milestone 3 similarity search with an optional document
-- scope, for "chat about this document" instead of searching the user's
-- entire library. Adding a parameter changes the function's identity in
-- Postgres (it's keyed by argument types), so CREATE OR REPLACE would just
-- create a second overload — drop the old 3-arg version explicitly first.
drop function if exists public.match_document_chunks(vector(1536), int, uuid);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid(),
  filter_document_id uuid default null
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
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;
