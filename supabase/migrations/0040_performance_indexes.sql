-- PIP Sprint 9/10 (Performance & Scale Validation).
--
-- Two additive indexes for query shapes already in production, found
-- during discovery to have no supporting index at all:
--
-- 1. ai_memory: every chat turn queries this table via
--    `retrieveMemoryContext` (filter by user via RLS, optionally by
--    workspace_id, filter is_active, order by updated_at desc), and the
--    Memory Management page does the same. The table has had zero
--    indexes beyond its primary key since it was created
--    (0010_reconcile_knowledge_tables.sql) — every one of those queries
--    has been a full table scan. user_id leads the index since RLS adds
--    `user_id = auth.uid()` to every query against this table regardless
--    of which optional filters (workspace_id, memory_type) a given call
--    also applies — a single composite index on the predicate that's
--    always present, plus the always-applied is_active filter and
--    updated_at ordering, serves every existing call shape without
--    needing a second index for the sometimes-nullable workspace_id.
--
-- 2. messages: `listMessages` filters by conversation_id (indexed since
--    0005_ai_chat.sql) and orders by created_at — the existing
--    single-column index can satisfy the filter but not the sort, so
--    every conversation load still sorts after the index scan. A
--    composite index lets both be satisfied by one index scan.
--
-- No new tables, no destructive change, no column changes — both indexes
-- are additive against existing columns.

create index if not exists ai_memory_user_active_updated_idx
  on public.ai_memory (user_id, is_active, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
