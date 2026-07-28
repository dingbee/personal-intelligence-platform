-- Knowledge Intelligence Engine Foundation (Phase 7A).
--
-- Audit (see Phase 7A report): knowledge_links is already a generic
-- polymorphic edge table (source_type/target_type are unconstrained text,
-- source_id/target_id have no FK) — it can already reference a new node
-- type without any change. What it lacks is the vocabulary AI-generated
-- edges need to be meaningful: what kind of relationship, how confident,
-- and what produced it. Those are added as nullable columns rather than a
-- new knowledge_edges table, so the read layer built in Phase 6C
-- (listKnowledgeLinks / GraphCanvas) keeps working unchanged and doesn't
-- need to union two edge tables.
--
-- No existing table can hold an AI-extracted concept or entity as a first-
-- class row: documents/notes/highlights are all anchored to something a
-- user created, and tags are a flat user-curated label with no
-- description/confidence/provenance. knowledge_nodes is new for that
-- reason — the one addition the audit did not find an existing home for.
--
-- No embedding column on knowledge_nodes: nodes carry source_chunk_ids
-- (the same provenance convention as notes/highlights/chapter_summaries/
-- flashcards from migration 0011), so semantic discovery over nodes can
-- later join through document_chunks -> embeddings using those ids
-- instead of generating and storing a second embedding per node.

create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- 'concept' | 'entity' — unconstrained text, same convention as
  -- knowledge_links.source_type/target_type (enforced in application code,
  -- not the database, so new node types don't require a migration).
  node_type text not null,
  title text not null,
  description text,
  -- What produced this node: source_type/source_id point at the document
  -- (today) the node was extracted from. source_chunk_ids narrows that to
  -- the specific chunks, mirroring migration 0011's provenance columns.
  source_type text not null,
  source_id uuid not null,
  source_chunk_ids jsonb,
  generation_metadata jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Re-running extraction on the same document is a no-op for a concept/
  -- entity it already found, rather than accumulating duplicates.
  unique (user_id, source_id, node_type, title)
);

alter table public.knowledge_links
  add column if not exists relationship_type text,
  add column if not exists confidence numeric,
  add column if not exists generated_by text,
  add column if not exists metadata jsonb;

create index if not exists knowledge_nodes_user_id_idx on public.knowledge_nodes (user_id);
create index if not exists knowledge_nodes_workspace_id_idx on public.knowledge_nodes (workspace_id);
create index if not exists knowledge_nodes_source_idx on public.knowledge_nodes (source_type, source_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_knowledge_nodes_updated_at'
  ) then
    create trigger set_knowledge_nodes_updated_at
      before update on public.knowledge_nodes
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.knowledge_nodes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'knowledge_nodes' and policyname = 'Users manage their own knowledge nodes'
  ) then
    create policy "Users manage their own knowledge nodes"
      on public.knowledge_nodes for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
