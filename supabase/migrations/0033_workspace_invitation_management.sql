-- UX-14.5.8.2 — Invitation Management: Cancel + Resend for pending
-- invitations, on top of Phase 1's `workspace_invitations` (0032).
--
-- Cancel needs one new thing: 0032 deliberately shipped with zero
-- client-side write policy on `workspace_invitations` (only the two
-- security-definer functions could write to it). Cancelling a pending
-- invitation is a plain, owner-gated row update with no cross-user
-- profile resolution involved — the same shape as `updateWorkspaceMemberRole`/
-- `removeWorkspaceMember`'s existing plain-RLS-UPDATE precedent on
-- `workspace_members`, not the RPC pattern `invite_to_workspace`/
-- `list_workspace_members` need. So: one new UPDATE policy, no RPC.
--
-- Resend needs nothing here at all. Re-inviting the same email through
-- the existing `invite_to_workspace` RPC already refreshes
-- `role`/`invited_by`/`expires_at`/`updated_at` via its own `on conflict
-- (workspace_id, email) where status = 'pending' do update` clause
-- (0032) — "Resend" in the application layer is just calling that same
-- mutation again with the invitation's own stored email/role. No email
-- is actually sent by this app yet (UX-14.5.8.3, still deferred), so
-- "resend" today means "renew the expiry and re-affirm who's inviting,"
-- not "send another email" — an honest description of what it does
-- until email delivery exists.

create policy "Workspace owners can cancel pending invitations"
  on public.workspace_invitations for update
  using (public.has_workspace_role(workspace_id, 'owner') and status = 'pending')
  with check (public.has_workspace_role(workspace_id, 'owner'));
