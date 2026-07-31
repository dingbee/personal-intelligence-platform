-- UX-13.11 Universal Search Phase 1 — notes join the search platform as
-- the first source added since the pattern was established in
-- 0007_search.sql: its own embeddings table + match function, registered
-- as a SearchProvider, no changes to search's aggregation logic.
-- notes.workspace_id is denormalized on the table itself already (unlike
-- messages, which only get workspace_id via a join through conversations),
-- so match_notes needs no extra join for workspace scoping.

create table public.note_embeddings (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null unique references public.notes (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index note_embeddings_embedding_idx on public.note_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.note_embeddings enable row level security;

create policy "Users manage embeddings on their own notes"
  on public.note_embeddings for all
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and notes.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and notes.user_id = auth.uid()
    )
  );

create or replace function public.match_notes(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid(),
  filter_workspace_id uuid default null
)
returns table (
  note_id uuid,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    notes.id as note_id,
    notes.title,
    notes.content,
    1 - (note_embeddings.embedding <=> query_embedding) as similarity
  from public.note_embeddings
  join public.notes on notes.id = note_embeddings.note_id
  where notes.user_id = filter_user_id
    and (filter_workspace_id is null or notes.workspace_id = filter_workspace_id)
  order by note_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
