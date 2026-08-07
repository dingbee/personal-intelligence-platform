-- Multimodal Intelligence v2 — closes Feature Area 1's explicit mandate:
-- OCR output/image analysis must become searchable knowledge, not dead
-- text. Mirrors note_embeddings/match_notes (0025_note_search.sql)
-- exactly, scoped by owner_id (assets' RLS column) instead of user_id.
create table public.asset_embeddings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.assets (id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index asset_embeddings_embedding_idx on public.asset_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.asset_embeddings enable row level security;

create policy "Users manage embeddings on their own assets"
  on public.asset_embeddings for all
  using (
    exists (
      select 1 from public.assets
      where assets.id = asset_embeddings.asset_id
        and assets.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assets
      where assets.id = asset_embeddings.asset_id
        and assets.owner_id = auth.uid()
    )
  );

create or replace function public.match_assets(
  query_embedding vector(1536),
  match_count int default 10,
  filter_user_id uuid default auth.uid(),
  filter_workspace_id uuid default null
)
returns table (
  asset_id uuid,
  title text,
  similarity float
)
language sql stable
as $$
  select
    assets.id as asset_id,
    assets.title,
    1 - (asset_embeddings.embedding <=> query_embedding) as similarity
  from public.asset_embeddings
  join public.assets on assets.id = asset_embeddings.asset_id
  where assets.owner_id = filter_user_id
    and (filter_workspace_id is null or assets.workspace_id = filter_workspace_id)
  order by asset_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
