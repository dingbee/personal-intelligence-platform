-- UX-13 roadmap Phase 4 — Knowledge Collections: a curated set of items
-- spanning any mix of documents/notes/conversations/assets/concepts, more
-- powerful than the existing single-type, single-parent `collections`
-- (documents-only folders). Deliberately just an identity/metadata table —
-- membership reuses the existing generic `knowledge_links` table exactly
-- the way linkNoteToHighlight/linkNoteToConversation/linkNoteToAsset
-- already do (source_type/target_type are plain strings, not FK-enforced),
-- so no new join table is needed: a membership row is
-- (source_type='knowledge_collection', source_id=<collection id>,
-- target_type=<'document'|'note'|'conversation'|'asset'|'knowledge_node'>,
-- target_id=<item id>).

create table public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_collections_user_id_idx on public.knowledge_collections (user_id);
create index knowledge_collections_workspace_id_idx on public.knowledge_collections (workspace_id);

create trigger set_knowledge_collections_updated_at
  before update on public.knowledge_collections
  for each row execute function public.set_updated_at();

alter table public.knowledge_collections enable row level security;

create policy "Users manage their own knowledge collections"
  on public.knowledge_collections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
