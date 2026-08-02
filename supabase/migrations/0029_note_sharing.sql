-- UX-14.5 Phase 2: Personal Object Sharing (Notes). Implements exactly
-- what docs/ux-14.5.5-note-sharing-design.md §3/§4 designed: extends
-- `notes`' RLS with has_workspace_role (Phase 1, 0028), split into four
-- per-command policies so owner/editor/viewer get different mutation
-- rights, plus the identical extension for its two child tables
-- (note_tags, note_embeddings) that §1.2's discovery found still
-- checking `notes.user_id = auth.uid()` directly. No new table, no
-- generic permissions framework, no invitations/sharing links — Option
-- A only, per the design doc's recommendation.
--
-- Backward compatibility: for a note with workspace_id = null, or in a
-- workspace with no other members, has_workspace_role(...) always
-- returns false (it has nothing to resolve), so every added OR-clause
-- below is a no-op and access continues to depend solely on
-- `auth.uid() = user_id`, identical to today. No backfill, no data
-- migration.

drop policy "Users manage their own notes" on public.notes;

create policy "Note owners and workspace members can view notes"
  on public.notes for select
  using (
    auth.uid() = user_id
    or public.has_workspace_role(workspace_id, 'viewer')
  );

-- Unchanged from the original policy: creating a note is always
-- self-attributed, regardless of workspace sharing (design doc §4) —
-- no membership check is needed because the inserting user is always
-- inserting as themselves.
create policy "Note owners can create notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Note owners and workspace editors can update notes"
  on public.notes for update
  using (
    auth.uid() = user_id
    or public.has_workspace_role(workspace_id, 'editor')
  )
  with check (
    auth.uid() = user_id
    or public.has_workspace_role(workspace_id, 'editor')
  );

-- Delete requires the resolved workspace *owner* specifically, not
-- editor — "full control" (design doc §2) is workspace-owner authority
-- over every note in the workspace, not merely creator-only delete, so
-- a workspace owner can remove a note an editor authored.
create policy "Note owners and workspace owners can delete notes"
  on public.notes for delete
  using (
    auth.uid() = user_id
    or public.has_workspace_role(workspace_id, 'owner')
  );

-- note_tags: was checking notes.user_id directly (design doc §1.2's
-- central finding). Tagging is note-editing, not note-deletion, so it
-- follows the same viewer-can-see / editor-can-change split as the
-- parent note's own select/update policies above.

drop policy "Users manage tags on their own notes" on public.note_tags;

create policy "Note tag visibility follows the parent note"
  on public.note_tags for select
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'viewer')
        )
    )
  );

create policy "Note tag changes require editor access to the parent note"
  on public.note_tags for insert
  with check (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  );

create policy "Note tag removal requires editor access to the parent note"
  on public.note_tags for delete
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_tags.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  );

-- note_embeddings: same finding, same fix. indexNote.ts upserts (not a
-- plain insert), so both insert and update policies are required for
-- Supabase's upsert to succeed regardless of which branch fires.

drop policy "Users manage embeddings on their own notes" on public.note_embeddings;

create policy "Note embedding visibility follows the parent note"
  on public.note_embeddings for select
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'viewer')
        )
    )
  );

create policy "Note embedding writes require editor access to the parent note"
  on public.note_embeddings for insert
  with check (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  );

create policy "Note embedding updates require editor access to the parent note"
  on public.note_embeddings for update
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  )
  with check (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  );

create policy "Note embedding removal requires editor access to parent note"
  on public.note_embeddings for delete
  using (
    exists (
      select 1 from public.notes
      where notes.id = note_embeddings.note_id
        and (
          notes.user_id = auth.uid()
          or public.has_workspace_role(notes.workspace_id, 'editor')
        )
    )
  );
