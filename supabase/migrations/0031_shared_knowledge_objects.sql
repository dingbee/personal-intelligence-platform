-- UX-14.5 Phase 4: Shared Knowledge Objects. Extends the workspace-
-- membership OR-clause pattern (Phase 1's has_workspace_role, applied
-- to notes/notes' child tables in Phase 2, workspaces itself in Phase
-- 3) to every object docs/ux-14.5.4 §3's access matrix classifies as
-- shareable: documents, knowledge nodes, knowledge links, conversations
-- (+messages), assets, knowledge collections, plus workspace_objectives
-- (the matrix's explicit one-row reclassification into the shareable
-- bucket). ai_memory, ai_requests, provider_overrides, and
-- reading_progress are untouched by this migration, on purpose — §4.1's
-- rule is "do not touch their RLS policy at all," not a narrower
-- version of the same pattern.
--
-- A write-attribution audit (mirroring the useNote.ts check from Phase
-- 2) confirmed every INSERT/UPSERT into these tables and their child
-- tables already attributes to the acting session's own user_id
-- (threaded from useAuth()'s user.id through each API/hook), not a
-- pre-existing row's stored owner — so unlike Phase 2, no companion
-- TypeScript attribution fix is required alongside this migration.
--
-- Two direct-table shapes, matching precedent exactly:
-- - Objects with their own workspace_id column (documents,
--   document_chunks, knowledge_nodes, knowledge_links, conversations,
--   assets, knowledge_collections, workspace_objectives) get the same
--   four-per-command split notes got in Phase 2: select at viewer-or-
--   above, insert unchanged (self-attributed), update at editor-or-
--   above, delete at the resolved workspace *owner* specifically.
-- - Child tables with no workspace_id of their own (embeddings,
--   document_tags, messages, message_embeddings, knowledge_node_sources)
--   route through their parent's workspace_id via EXISTS, exactly like
--   note_tags/note_embeddings did in Phase 2 — otherwise a shared
--   document's chunks/tags stay invisible even though the document row
--   itself is visible.
--
-- Backward compatibility is identical to every prior phase: for a row
-- with workspace_id = null (or in a workspace with no other members),
-- has_workspace_role(...) always returns false, so every added
-- OR-clause is a no-op and access continues to depend solely on
-- auth.uid() = user_id (or owner_id for assets), unchanged from today.

-- 1. documents

drop policy "Users manage their own documents" on public.documents;

create policy "Document owners and workspace members can view documents"
  on public.documents for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Document owners can create documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Document owners and workspace editors can update documents"
  on public.documents for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Document owners and workspace owners can delete documents"
  on public.documents for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 2. document_chunks (already denormalizes workspace_id onto itself)

drop policy "Users manage their own document chunks" on public.document_chunks;

create policy "Document chunk visibility follows workspace membership"
  on public.document_chunks for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Document chunk owners can create chunks"
  on public.document_chunks for insert
  with check (auth.uid() = user_id);

create policy "Document chunk owners and workspace editors can update chunks"
  on public.document_chunks for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Document chunk owners and workspace owners can delete chunks"
  on public.document_chunks for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 3. embeddings (child of document_chunks, no workspace_id/user_id of its own)

drop policy "Users manage embeddings on their own chunks" on public.embeddings;

create policy "Embedding visibility follows the parent chunk"
  on public.embeddings for select
  using (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and (
          document_chunks.user_id = auth.uid()
          or public.has_workspace_role(document_chunks.workspace_id, 'viewer')
        )
    )
  );

create policy "Embedding writes require editor access to the parent chunk"
  on public.embeddings for insert
  with check (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and (
          document_chunks.user_id = auth.uid()
          or public.has_workspace_role(document_chunks.workspace_id, 'editor')
        )
    )
  );

create policy "Embedding updates require editor access to the parent chunk"
  on public.embeddings for update
  using (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and (
          document_chunks.user_id = auth.uid()
          or public.has_workspace_role(document_chunks.workspace_id, 'editor')
        )
    )
  )
  with check (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and (
          document_chunks.user_id = auth.uid()
          or public.has_workspace_role(document_chunks.workspace_id, 'editor')
        )
    )
  );

create policy "Embedding removal requires editor access to the parent chunk"
  on public.embeddings for delete
  using (
    exists (
      select 1 from public.document_chunks
      where document_chunks.id = embeddings.chunk_id
        and (
          document_chunks.user_id = auth.uid()
          or public.has_workspace_role(document_chunks.workspace_id, 'editor')
        )
    )
  );

-- 4. document_tags (child of documents, same shape as note_tags in Phase 2)

drop policy "Users manage tags on their own documents" on public.document_tags;

create policy "Document tag visibility follows the parent document"
  on public.document_tags for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_tags.document_id
        and (
          documents.user_id = auth.uid()
          or public.has_workspace_role(documents.workspace_id, 'viewer')
        )
    )
  );

create policy "Document tag changes require editor access to parent document"
  on public.document_tags for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_tags.document_id
        and (
          documents.user_id = auth.uid()
          or public.has_workspace_role(documents.workspace_id, 'editor')
        )
    )
  );

create policy "Document tag removal requires editor access to parent document"
  on public.document_tags for delete
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_tags.document_id
        and (
          documents.user_id = auth.uid()
          or public.has_workspace_role(documents.workspace_id, 'editor')
        )
    )
  );

-- 5. knowledge_nodes

drop policy "Users manage their own knowledge nodes" on public.knowledge_nodes;

create policy "Knowledge node owners and workspace members can view nodes"
  on public.knowledge_nodes for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Knowledge node owners can create nodes"
  on public.knowledge_nodes for insert
  with check (auth.uid() = user_id);

create policy "Knowledge node owners and workspace editors can update nodes"
  on public.knowledge_nodes for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Knowledge node owners and workspace owners can delete nodes"
  on public.knowledge_nodes for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 6. knowledge_node_sources (child of knowledge_nodes; append-only evidence
-- ledger in practice — only ever selected and inserted, never updated/
-- deleted directly, so only those two policies are granted)

drop policy "Users manage their own knowledge node sources" on public.knowledge_node_sources;

create policy "Knowledge node source visibility follows the parent node"
  on public.knowledge_node_sources for select
  using (
    exists (
      select 1 from public.knowledge_nodes
      where knowledge_nodes.id = knowledge_node_sources.node_id
        and (
          knowledge_nodes.user_id = auth.uid()
          or public.has_workspace_role(knowledge_nodes.workspace_id, 'viewer')
        )
    )
  );

create policy "Knowledge node sources require editor access to parent node"
  on public.knowledge_node_sources for insert
  with check (
    exists (
      select 1 from public.knowledge_nodes
      where knowledge_nodes.id = knowledge_node_sources.node_id
        and (
          knowledge_nodes.user_id = auth.uid()
          or public.has_workspace_role(knowledge_nodes.workspace_id, 'editor')
        )
    )
  );

-- 7. knowledge_links

drop policy "Users manage their own knowledge links" on public.knowledge_links;

create policy "Knowledge link owners and workspace members can view links"
  on public.knowledge_links for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Knowledge link owners can create links"
  on public.knowledge_links for insert
  with check (auth.uid() = user_id);

create policy "Knowledge link owners and workspace editors can update links"
  on public.knowledge_links for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Knowledge link owners and workspace owners can delete links"
  on public.knowledge_links for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 8. knowledge_collections

drop policy "Users manage their own knowledge collections" on public.knowledge_collections;

create policy "Knowledge collection owners and members can view collections"
  on public.knowledge_collections for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Knowledge collection owners can create collections"
  on public.knowledge_collections for insert
  with check (auth.uid() = user_id);

create policy "Knowledge collection owners and editors can update collections"
  on public.knowledge_collections for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Knowledge collection owners can delete collections"
  on public.knowledge_collections for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 9. conversations

drop policy "Users manage their own conversations" on public.conversations;

create policy "Conversation owners and members can view conversations"
  on public.conversations for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Conversation owners can create conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Conversation owners and editors can update conversations"
  on public.conversations for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Conversation owners can delete conversations"
  on public.conversations for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 10. messages (child of conversations, no workspace_id of its own; update
-- is included because assistant replies are patched as they stream in)

drop policy "Users manage their own messages" on public.messages;

create policy "Message visibility follows the parent conversation"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'viewer')
        )
    )
  );

create policy "Message creation requires editor access to parent conversation"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  );

create policy "Message updates require editor access to parent conversation"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  )
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  );

-- 11. message_embeddings (child of messages, two hops from workspace_id)

drop policy "Users manage embeddings on their own messages" on public.message_embeddings;

create policy "Message embedding visibility follows the parent conversation"
  on public.message_embeddings for select
  using (
    exists (
      select 1 from public.messages
      join public.conversations on conversations.id = messages.conversation_id
      where messages.id = message_embeddings.message_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'viewer')
        )
    )
  );

create policy "Message embedding writes require editor access to parent convo"
  on public.message_embeddings for insert
  with check (
    exists (
      select 1 from public.messages
      join public.conversations on conversations.id = messages.conversation_id
      where messages.id = message_embeddings.message_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  );

create policy "Message embedding updates require editor access to parent convo"
  on public.message_embeddings for update
  using (
    exists (
      select 1 from public.messages
      join public.conversations on conversations.id = messages.conversation_id
      where messages.id = message_embeddings.message_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  )
  with check (
    exists (
      select 1 from public.messages
      join public.conversations on conversations.id = messages.conversation_id
      where messages.id = message_embeddings.message_id
        and (
          conversations.user_id = auth.uid()
          or public.has_workspace_role(conversations.workspace_id, 'editor')
        )
    )
  );

-- 12. assets (uses owner_id, not user_id)

drop policy "Users manage their own assets" on public.assets;

create policy "Asset owners and workspace members can view assets"
  on public.assets for select
  using (auth.uid() = owner_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Asset owners can create assets"
  on public.assets for insert
  with check (auth.uid() = owner_id);

create policy "Asset owners and workspace editors can update assets"
  on public.assets for update
  using (auth.uid() = owner_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = owner_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Asset owners and workspace owners can delete assets"
  on public.assets for delete
  using (auth.uid() = owner_id or public.has_workspace_role(workspace_id, 'owner'));

-- 13. workspace_objectives (docs/ux-14.5.4 §3's explicit reclassification
-- into the shareable bucket, not excluded alongside ai_memory)

drop policy "Users manage their own workspace objectives" on public.workspace_objectives;

create policy "Workspace objective owners and members can view objectives"
  on public.workspace_objectives for select
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Workspace objective owners can create objectives"
  on public.workspace_objectives for insert
  with check (auth.uid() = user_id);

create policy "Workspace objective owners and editors can update objectives"
  on public.workspace_objectives for update
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'))
  with check (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'editor'));

create policy "Workspace objective owners can delete objectives"
  on public.workspace_objectives for delete
  using (auth.uid() = user_id or public.has_workspace_role(workspace_id, 'owner'));

-- 14. match_document_chunks / match_messages: the retrieval-layer follow-up
-- docs/ux-14.5.4 §4.3 requires in the same unit of work as the RLS above.
-- Both functions had their own hard-coded `user_id = filter_user_id`
-- clause, independent of table RLS, that only ever matched the calling
-- user's own rows regardless of `filter_workspace_id` — a document
-- correctly visible as a row (RLS above) but invisible to chat retrieval
-- over its content, the exact "confusing partial state" §4.3 warns
-- against. Fixed by checking the row's own workspace_id against
-- has_workspace_role directly (not just the filter parameter), so this
-- also correctly covers document-scoped chat, which deliberately omits
-- filter_workspace_id (see retrieveContext.ts) in favor of always
-- finding that one document's chunks regardless of current workspace.

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
language sql
stable
as $$
  select
    document_chunks.id as chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from public.embeddings
  join public.document_chunks on document_chunks.id = embeddings.chunk_id
  where (
      document_chunks.user_id = filter_user_id
      or (
        document_chunks.workspace_id is not null
        and public.has_workspace_role(document_chunks.workspace_id, 'viewer')
      )
    )
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
language sql
stable
as $$
  select
    messages.id as message_id,
    messages.conversation_id,
    messages.content,
    1 - (message_embeddings.embedding <=> query_embedding) as similarity
  from public.message_embeddings
  join public.messages on messages.id = message_embeddings.message_id
  join public.conversations on conversations.id = messages.conversation_id
  where (
      messages.user_id = filter_user_id
      or (
        conversations.workspace_id is not null
        and public.has_workspace_role(conversations.workspace_id, 'viewer')
      )
    )
    and (filter_workspace_id is null or conversations.workspace_id = filter_workspace_id)
  order by message_embeddings.embedding <=> query_embedding
  limit match_count;
$$;
