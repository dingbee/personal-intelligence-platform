-- Milestone 3: document processing pipeline (extraction, chunking,
-- placeholder embeddings, metadata indexing).

create type processing_status as enum (
  'queued',
  'extracting',
  'chunking',
  'embedding',
  'completed',
  'failed'
);

create table public.processing_jobs (
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

create table public.extraction_metadata (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  author text,
  language text,
  page_count int,
  chapter_count int,
  word_count int,
  char_count int,
  -- Free-form extras that vary by file type, e.g. `{ "chapters": [{ "index", "title" }] }`
  -- for EPUB. Keep querying by known columns above; use this only for display/debug.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_chunks (
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

-- Placeholder dimension: 1536 matches common providers (e.g. OpenAI
-- text-embedding-3-small). Changing embedding models with a different
-- dimensionality requires a follow-up migration to alter this column.
create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.document_chunks (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index processing_jobs_document_id_idx on public.processing_jobs (document_id);
create index document_chunks_document_id_idx on public.document_chunks (document_id);
create index document_chunks_user_id_idx on public.document_chunks (user_id);

-- HNSW index for cosine similarity search. Cheap to keep even while
-- embeddings are placeholders; real semantic search (Milestone 5) needs it.
create index embeddings_embedding_idx on public.embeddings
  using hnsw (embedding vector_cosine_ops);

create trigger set_processing_jobs_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();

create trigger set_extraction_metadata_updated_at
  before update on public.extraction_metadata
  for each row execute function public.set_updated_at();

alter table public.processing_jobs enable row level security;
alter table public.extraction_metadata enable row level security;
alter table public.document_chunks enable row level security;
alter table public.embeddings enable row level security;

create policy "Users manage their own processing jobs"
  on public.processing_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own extraction metadata"
  on public.extraction_metadata for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own document chunks"
  on public.document_chunks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage embeddings on their own chunks"
  on public.embeddings for all
  using (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and document_chunks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and document_chunks.user_id = auth.uid()
    )
  );

-- Similarity search over a user's own chunks. Mechanically real (pgvector
-- cosine distance); results are only as meaningful as the embeddings fed
-- into it — placeholder embeddings will return placeholder-quality matches
-- until Milestone 4 wires up a real EmbeddingProvider.
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid()
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
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;
