-- Phase 9A: canonical knowledge identity foundation.
--
-- Today a knowledge_nodes row is scoped to the single document it was
-- extracted from (unique on user_id/source_id/node_type/title) — the same
-- concept extracted from two different documents becomes two disconnected
-- rows. This migration adds the tracking needed to resolve future
-- extractions against an existing node instead of always inserting a new
-- one, WITHOUT touching any existing row, column meaning, or constraint:
--
-- - title_normalized is purely additive and used only for lookup; nothing
--   reads/writes title itself differently.
-- - No new hard uniqueness is added on knowledge_nodes. Production may
--   already contain multiple rows sharing a normalized title (the exact
--   scenario this phase addresses going forward) — a hard constraint here
--   would fail to apply against that existing data, and merging/deleting
--   those rows to make room for one is explicitly out of scope for this
--   additive, reversible phase. Deduplication of *new* extractions is
--   enforced in application code (see resolveCanonicalNode), not the DB.
-- - knowledge_node_sources is a brand-new table — safe to give it a real
--   unique constraint since it starts empty.
--
-- Rollback: drop knowledge_node_sources, drop the index and column on
-- knowledge_nodes. Nothing else references either.

alter table public.knowledge_nodes
  add column if not exists title_normalized text;

-- Same normalization resolveCanonicalNode uses in application code — see
-- normalizeTitle.ts. Order matters: strip punctuation to a space (never
-- merge adjacent words), then collapse whitespace, then lowercase.
update public.knowledge_nodes
set title_normalized = lower(
  trim(
    regexp_replace(
      regexp_replace(trim(title), '[^\w\s]', ' ', 'g'),
      '\s+', ' ', 'g'
    )
  )
)
where title_normalized is null;

alter table public.knowledge_nodes
  alter column title_normalized set not null;

-- Supports resolveCanonicalNode's exact-match lookup — not a uniqueness
-- guarantee (see above), just an index for the (user_id, node_type,
-- title_normalized) query it runs before every insert.
create index if not exists knowledge_nodes_normalized_lookup_idx
  on public.knowledge_nodes (user_id, node_type, title_normalized);

create table if not exists public.knowledge_node_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id uuid not null references public.knowledge_nodes (id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  source_chunk_ids jsonb,
  created_at timestamptz not null default now(),
  -- Re-extracting the same document against an already-resolved node
  -- refreshes this row rather than piling up duplicates.
  unique (node_id, source_type, source_id)
);

create index if not exists knowledge_node_sources_user_id_idx on public.knowledge_node_sources (user_id);
create index if not exists knowledge_node_sources_node_id_idx on public.knowledge_node_sources (node_id);
create index if not exists knowledge_node_sources_source_idx on public.knowledge_node_sources (source_type, source_id);

alter table public.knowledge_node_sources enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'knowledge_node_sources' and policyname = 'Users manage their own knowledge node sources'
  ) then
    create policy "Users manage their own knowledge node sources"
      on public.knowledge_node_sources for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Backfill: every existing knowledge_nodes row already has exactly one
-- implicit source (itself) — seed the ledger from it. Insert-only,
-- idempotent, and reversible (drop the table to undo).
insert into public.knowledge_node_sources (user_id, node_id, source_type, source_id, source_chunk_ids, created_at)
select user_id, id, source_type, source_id, source_chunk_ids, created_at
from public.knowledge_nodes
on conflict (node_id, source_type, source_id) do nothing;
