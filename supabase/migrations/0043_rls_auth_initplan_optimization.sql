-- Phase 3 Quality Hardening: RLS auth initplan performance optimization.
-- Wraps every direct auth.uid() call inside the 83 flagged RLS policies as
-- (select auth.uid()), per Supabase's documented fix for auth_rls_initplan.
-- auth.uid() is STABLE and takes no row-dependent argument, so this changes
-- only *when* Postgres evaluates it (once per statement via InitPlan,
-- instead of once per row) -- not what it returns. Authorization semantics
-- are therefore unchanged for every policy touched.
--
-- Untouched by design: has_workspace_role(...) calls (a separate
-- SECURITY DEFINER function, out of scope), and the 8 policies that never
-- called auth.uid()/auth.role() directly (plans/plan_quotas/
-- platform_provider_settings use `true`; workspace_invitations and three
-- workspace_members policies use only has_workspace_role()).

ALTER POLICY "Users manage their own AI memory" ON public.ai_memory
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users insert their own AI requests" ON public.ai_requests
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users view their own AI requests" ON public.ai_requests
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users manage embeddings on their own assets" ON public.asset_embeddings
  USING ((EXISTS ( SELECT 1
   FROM assets
  WHERE ((assets.id = asset_embeddings.asset_id) AND (assets.owner_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM assets
  WHERE ((assets.id = asset_embeddings.asset_id) AND (assets.owner_id = (select auth.uid()))))));

ALTER POLICY "Asset owners and workspace editors can update assets" ON public.assets
  USING ((((select auth.uid()) = owner_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = owner_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Asset owners and workspace members can view assets" ON public.assets
  USING ((((select auth.uid()) = owner_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Asset owners and workspace owners can delete assets" ON public.assets
  USING ((((select auth.uid()) = owner_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Asset owners can create assets" ON public.assets
  WITH CHECK (((select auth.uid()) = owner_id));

ALTER POLICY "Users manage their own chapter summaries" ON public.chapter_summaries
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own collections" ON public.collections
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Conversation owners and editors can update conversations" ON public.conversations
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Conversation owners and members can view conversations" ON public.conversations
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Conversation owners can create conversations" ON public.conversations
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Conversation owners can delete conversations" ON public.conversations
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Users manage their own dismissed suggestions" ON public.dismissed_suggestions
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Document chunk owners and workspace editors can update chunks" ON public.document_chunks
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Document chunk owners and workspace owners can delete chunks" ON public.document_chunks
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Document chunk owners can create chunks" ON public.document_chunks
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Document chunk visibility follows workspace membership" ON public.document_chunks
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Document tag changes require editor access to parent document" ON public.document_tags
  WITH CHECK ((EXISTS ( SELECT 1
   FROM documents
  WHERE ((documents.id = document_tags.document_id) AND ((documents.user_id = (select auth.uid())) OR has_workspace_role(documents.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Document tag removal requires editor access to parent document" ON public.document_tags
  USING ((EXISTS ( SELECT 1
   FROM documents
  WHERE ((documents.id = document_tags.document_id) AND ((documents.user_id = (select auth.uid())) OR has_workspace_role(documents.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Document tag visibility follows the parent document" ON public.document_tags
  USING ((EXISTS ( SELECT 1
   FROM documents
  WHERE ((documents.id = document_tags.document_id) AND ((documents.user_id = (select auth.uid())) OR has_workspace_role(documents.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Document owners and workspace editors can update documents" ON public.documents
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Document owners and workspace members can view documents" ON public.documents
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Document owners and workspace owners can delete documents" ON public.documents
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Document owners can create documents" ON public.documents
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Embedding removal requires editor access to the parent chunk" ON public.embeddings
  USING ((EXISTS ( SELECT 1
   FROM document_chunks
  WHERE ((document_chunks.id = embeddings.chunk_id) AND ((document_chunks.user_id = (select auth.uid())) OR has_workspace_role(document_chunks.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Embedding updates require editor access to the parent chunk" ON public.embeddings
  USING ((EXISTS ( SELECT 1
   FROM document_chunks
  WHERE ((document_chunks.id = embeddings.chunk_id) AND ((document_chunks.user_id = (select auth.uid())) OR has_workspace_role(document_chunks.workspace_id, 'editor'::workspace_member_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM document_chunks
  WHERE ((document_chunks.id = embeddings.chunk_id) AND ((document_chunks.user_id = (select auth.uid())) OR has_workspace_role(document_chunks.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Embedding visibility follows the parent chunk" ON public.embeddings
  USING ((EXISTS ( SELECT 1
   FROM document_chunks
  WHERE ((document_chunks.id = embeddings.chunk_id) AND ((document_chunks.user_id = (select auth.uid())) OR has_workspace_role(document_chunks.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Embedding writes require editor access to the parent chunk" ON public.embeddings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM document_chunks
  WHERE ((document_chunks.id = embeddings.chunk_id) AND ((document_chunks.user_id = (select auth.uid())) OR has_workspace_role(document_chunks.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Users manage their own extraction metadata" ON public.extraction_metadata
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own flashcards" ON public.flashcards
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own highlights" ON public.highlights
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Knowledge collection owners and editors can update collections" ON public.knowledge_collections
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Knowledge collection owners and members can view collections" ON public.knowledge_collections
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Knowledge collection owners can create collections" ON public.knowledge_collections
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Knowledge collection owners can delete collections" ON public.knowledge_collections
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Knowledge link owners and workspace editors can update links" ON public.knowledge_links
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Knowledge link owners and workspace members can view links" ON public.knowledge_links
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Knowledge link owners and workspace owners can delete links" ON public.knowledge_links
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Knowledge link owners can create links" ON public.knowledge_links
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Knowledge node source visibility follows the parent node" ON public.knowledge_node_sources
  USING ((EXISTS ( SELECT 1
   FROM knowledge_nodes
  WHERE ((knowledge_nodes.id = knowledge_node_sources.node_id) AND ((knowledge_nodes.user_id = (select auth.uid())) OR has_workspace_role(knowledge_nodes.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Knowledge node sources require editor access to parent node" ON public.knowledge_node_sources
  WITH CHECK ((EXISTS ( SELECT 1
   FROM knowledge_nodes
  WHERE ((knowledge_nodes.id = knowledge_node_sources.node_id) AND ((knowledge_nodes.user_id = (select auth.uid())) OR has_workspace_role(knowledge_nodes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Knowledge node owners and workspace editors can update nodes" ON public.knowledge_nodes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Knowledge node owners and workspace members can view nodes" ON public.knowledge_nodes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Knowledge node owners and workspace owners can delete nodes" ON public.knowledge_nodes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Knowledge node owners can create nodes" ON public.knowledge_nodes
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Message embedding updates require editor access to parent convo" ON public.message_embeddings
  USING ((EXISTS ( SELECT 1
   FROM (messages
     JOIN conversations ON ((conversations.id = messages.conversation_id)))
  WHERE ((messages.id = message_embeddings.message_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages
     JOIN conversations ON ((conversations.id = messages.conversation_id)))
  WHERE ((messages.id = message_embeddings.message_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Message embedding visibility follows the parent conversation" ON public.message_embeddings
  USING ((EXISTS ( SELECT 1
   FROM (messages
     JOIN conversations ON ((conversations.id = messages.conversation_id)))
  WHERE ((messages.id = message_embeddings.message_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Message embedding writes require editor access to parent convo" ON public.message_embeddings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (messages
     JOIN conversations ON ((conversations.id = messages.conversation_id)))
  WHERE ((messages.id = message_embeddings.message_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Message creation requires editor access to parent conversation" ON public.messages
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Message updates require editor access to parent conversation" ON public.messages
  USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Message visibility follows the parent conversation" ON public.messages
  USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.user_id = (select auth.uid())) OR has_workspace_role(conversations.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Note embedding removal requires editor access to parent note" ON public.note_embeddings
  USING ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_embeddings.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Note embedding updates require editor access to the parent note" ON public.note_embeddings
  USING ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_embeddings.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_embeddings.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Note embedding visibility follows the parent note" ON public.note_embeddings
  USING ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_embeddings.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Note embedding writes require editor access to the parent note" ON public.note_embeddings
  WITH CHECK ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_embeddings.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Note tag changes require editor access to the parent note" ON public.note_tags
  WITH CHECK ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_tags.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Note tag removal requires editor access to the parent note" ON public.note_tags
  USING ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_tags.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'editor'::workspace_member_role))))));

ALTER POLICY "Note tag visibility follows the parent note" ON public.note_tags
  USING ((EXISTS ( SELECT 1
   FROM notes
  WHERE ((notes.id = note_tags.note_id) AND ((notes.user_id = (select auth.uid())) OR has_workspace_role(notes.workspace_id, 'viewer'::workspace_member_role))))));

ALTER POLICY "Note owners and workspace editors can update notes" ON public.notes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Note owners and workspace members can view notes" ON public.notes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Note owners and workspace owners can delete notes" ON public.notes
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Note owners can create notes" ON public.notes
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can check their own admin status" ON public.platform_admins
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own processing jobs" ON public.processing_jobs
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own profile" ON public.profiles
  USING (((select auth.uid()) = id));

ALTER POLICY "Users can view their own profile" ON public.profiles
  USING (((select auth.uid()) = id));

ALTER POLICY "Users manage their own provider overrides" ON public.provider_overrides
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own quota usage" ON public.quota_usage
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own reading progress" ON public.reading_progress
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users manage their own tags" ON public.tags
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own plan assignment" ON public.user_plan_assignments
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own quota override" ON public.user_quota_overrides
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Members can view workspace membership" ON public.workspace_members
  USING (((user_id = (select auth.uid())) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Workspace objective owners and editors can update objectives" ON public.workspace_objectives
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'editor'::workspace_member_role)));

ALTER POLICY "Workspace objective owners and members can view objectives" ON public.workspace_objectives
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'viewer'::workspace_member_role)));

ALTER POLICY "Workspace objective owners can create objectives" ON public.workspace_objectives
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Workspace objective owners can delete objectives" ON public.workspace_objectives
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(workspace_id, 'owner'::workspace_member_role)));

ALTER POLICY "Workspace creators can create workspaces" ON public.workspaces
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Workspace owners and members can view their workspaces" ON public.workspaces
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(id, 'viewer'::workspace_member_role) OR (EXISTS ( SELECT 1
   FROM workspace_members
  WHERE ((workspace_members.workspace_id = workspaces.id) AND (workspace_members.user_id = (select auth.uid())) AND (workspace_members.status = 'pending'::workspace_member_status))))));

ALTER POLICY "Workspace owners can delete their workspaces" ON public.workspaces
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(id, 'owner'::workspace_member_role)));

ALTER POLICY "Workspace owners can update their workspaces" ON public.workspaces
  USING ((((select auth.uid()) = user_id) OR has_workspace_role(id, 'owner'::workspace_member_role)))
  WITH CHECK ((((select auth.uid()) = user_id) OR has_workspace_role(id, 'owner'::workspace_member_role)));
