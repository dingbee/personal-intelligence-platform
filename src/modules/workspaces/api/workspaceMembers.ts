import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
  WorkspaceMemberWithProfile,
} from '@/shared/types/database'

/** UX-14.5.8 Phase 1 — the one normalization rule for every email this app ever compares: trim, then lower-case. Applied client-side here as the first line of defense; `invite_to_workspace` normalizes again server-side, since a client can't be trusted as the only place this happens. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * UX-14.5 Phase 1 — a direct write path for `workspace_members`. Not
 * called from the invitation UI (that goes through `inviteToWorkspace`,
 * below, which resolves an email to a user_id via a security-definer
 * RPC that a plain client-side insert can't do) — every new workspace's
 * `owner` row is also created automatically by
 * `0028_workspace_members.sql`'s trigger, not this function. Kept as the
 * fully-tested primitive it always was; useful for any future write
 * that already has a concrete user_id in hand.
 */
export async function createWorkspaceMembership(params: {
  workspaceId: string
  userId: string
  role: WorkspaceMemberRole
  status?: WorkspaceMemberStatus
  invitedBy?: string | null
}): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      role: params.role,
      status: params.status ?? 'active',
      invited_by: params.invitedBy ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export type InviteToWorkspaceResult =
  | { outcome: 'member_invited'; membership_id: string }
  | { outcome: 'invitation_created'; invitation_id: string }

/**
 * UX-14.5 Phase 3, extended UX-14.5.8 Phase 1 — the one write path for
 * creating an invitation. `profiles` RLS is intentionally self-only, so
 * resolving `invitee email -> user_id` can't happen in a plain client
 * query; this calls the `invite_to_workspace` security-definer RPC
 * (`0030_workspace_membership_management.sql`, redefined by
 * `0032_workspace_invitations.sql`), which does that lookup and the
 * owner-authorization check server-side. Ownership can't be granted
 * through this path — `invitee_role` is typed to exclude 'owner',
 * matching the RPC's own guard.
 *
 * As of 0032, an email with no matching account no longer fails — the
 * RPC records a `workspace_invitations` row instead, resolved
 * automatically the moment that person signs up (see
 * `ux-14.5.8-workspace-invitations-discovery.md`). The two outcomes are
 * indistinguishable to the caller in every way that matters (both are
 * success), which is deliberate: it closes the discovery's live-confirmed
 * account-enumeration finding as a side effect of the redesign, not a
 * separate patch.
 */
export async function inviteToWorkspace(params: {
  workspaceId: string
  email: string
  role: Exclude<WorkspaceMemberRole, 'owner'>
}): Promise<InviteToWorkspaceResult> {
  const { data, error } = await supabase.rpc('invite_to_workspace', {
    target_workspace_id: params.workspaceId,
    invitee_email: normalizeEmail(params.email),
    invitee_role: params.role,
  })
  if (error) throw error
  return data as InviteToWorkspaceResult
}

/**
 * UX-14.5.8 Phase 1 — a workspace's outstanding email-based invitations
 * (`workspace_invitations`, distinct from `listMyPendingInvitations`
 * below, which is the *invitee's* view across every workspace of the
 * unrelated `workspace_members`-based pending-row flow for an already-
 * known user). No RPC needed here, unlike `listWorkspaceMembers` — each
 * row already carries the invitee's email directly, so there's no
 * `profiles` cross-user join to bridge; a plain RLS-gated select is
 * sufficient (see the table's own SELECT policy, viewer-or-above).
 */
export async function listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * UX-14.5.8.2 — an owner cancelling a pending email-based invitation.
 * Plain client-side update, gated by the owner-only UPDATE policy
 * `0033_workspace_invitation_management.sql` added — no RPC needed, the
 * same shape as `updateWorkspaceMemberRole`/`removeWorkspaceMember`
 * below, since there's no cross-user profile resolution involved (this
 * table doesn't need one, unlike `invite_to_workspace`/
 * `list_workspace_members`). "Resend" needs no dedicated function at
 * all — it's just calling `inviteToWorkspace` again with the same
 * email/role, which already refreshes this row in place via its own
 * `on conflict` clause.
 */
export async function cancelWorkspaceInvitation(invitationId: string): Promise<WorkspaceInvitation> {
  const { data, error } = await supabase
    .from('workspace_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Diagnostic error-surfacing fix — `supabase.functions.invoke()` throws a
 * `FunctionsHttpError` for any non-2xx response whose `.message` is always
 * the same hardcoded string ("Edge Function returned a non-2xx status
 * code"), regardless of what the function actually reported. The real
 * reason lives in the HTTP response body, reachable via the error's own
 * `.context` (the raw `Response` object — this is the pattern
 * `@supabase/supabase-js`'s own docs recommend for `FunctionsHttpError`).
 * `send-workspace-invitation` always responds with `{ error: string }` on
 * failure (see that function's `errorResponse` helper), so this reads
 * exactly that one field and nothing else — never the full body, headers,
 * or any other property that could carry something sensitive. Any read
 * failure (non-JSON body, empty body, unexpected shape) falls back to the
 * original generic `error.message`, so this can only ever add information,
 * never lose the pre-existing behavior.
 */
async function extractEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  const fallbackMessage = error instanceof Error ? error.message : 'Failed to send invitation email'
  if (!(error instanceof FunctionsHttpError)) return fallbackMessage

  try {
    const body: unknown = await error.context.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const serverMessage = (body as { error: unknown }).error
      if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) return serverMessage
    }
  } catch {
    // Response body wasn't valid JSON (or couldn't be read) — use the generic fallback below.
  }

  return fallbackMessage
}

/**
 * UX-14.5.8.3 — invokes the `send-workspace-invitation` edge function,
 * this app's first service-role-key trust boundary (see that function's
 * own header comment for the full security rationale). Deliberately takes
 * only IDs, never workspace name/role/email: the function re-resolves
 * everything itself from the database, so a compromised or stale client
 * can't inject content into the email it sends. `supabase.functions.invoke`
 * automatically forwards the caller's own session JWT as the Authorization
 * header — never a service-role key, which only exists server-side.
 *
 * Returns `{ error }` rather than throwing so callers (the invite/resend
 * mutations below) can treat "invitation created, email failed" as a
 * distinct, non-corrupting outcome from "invitation creation itself
 * failed" — see those mutations' own doc-comments.
 */
export async function sendWorkspaceInvitationEmail(params: {
  workspaceId: string
  kind: 'invitation' | 'membership'
  id: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('send-workspace-invitation', { body: params })
  return { error: error ? await extractEdgeFunctionErrorMessage(error) : null }
}

/** Maps `inviteToWorkspace`'s two possible outcomes onto `sendWorkspaceInvitationEmail`'s `kind`/`id` shape, so call sites don't need to know the edge function's request contract. */
export async function sendInvitationEmailForResult(
  workspaceId: string,
  result: InviteToWorkspaceResult,
): Promise<string | null> {
  const { error } = await sendWorkspaceInvitationEmail(
    result.outcome === 'invitation_created'
      ? { workspaceId, kind: 'invitation', id: result.invitation_id }
      : { workspaceId, kind: 'membership', id: result.membership_id },
  )
  return error
}

/**
 * UX-14.5 Phase 3 — an invitee accepting or declining their own
 * pending invitation, via the `respond_to_workspace_invitation`
 * security-definer RPC. Deliberately not a plain UPDATE/DELETE: the RPC
 * only ever touches `status` (accept) or removes the row (decline) for
 * a row that's the caller's own and still pending, with no path to
 * change `role` — see the migration's own comment for why that matters.
 */
export async function respondToWorkspaceInvitation(
  membershipId: string,
  accept: boolean,
): Promise<WorkspaceMember> {
  const { data, error } = await supabase.rpc('respond_to_workspace_invitation', {
    target_membership_id: membershipId,
    accept,
  })
  if (error) throw error
  return data
}

/**
 * UX-14.5 Phase 3 — the current user's own pending invitations across
 * every workspace, for a "you've been invited" surface. Already
 * self-scoped by `workspace_members`' own SELECT RLS (`user_id =
 * auth.uid()` matches regardless of status), so this needs no RPC —
 * the workspace name join works too, since a pending invitee can now
 * see the workspace itself (the new pending-invite SELECT clause on
 * `workspaces`, same migration).
 */
export async function listMyPendingInvitations(): Promise<(WorkspaceMember & { workspace: { name: string } | null })[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as (WorkspaceMember & { workspaces: { name: string } | null })[]).map((row) => ({
    ...row,
    workspace: row.workspaces,
  }))
}

/**
 * UX-14.5 Phase 3 — the member-management page's read path. Calls the
 * `list_workspace_members` RPC rather than a plain select, for the same
 * reason `inviteToWorkspace` needs one: rendering "who's who" needs
 * each member's email, and `profiles` RLS won't allow a normal
 * cross-user join. The RPC also synthesizes the implicit owner row for
 * a workspace with no explicit `workspace_members` row for its creator
 * (every workspace older than the 0028 trigger), so backward
 * compatibility holds — a single-user workspace's roster is never
 * empty.
 */
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberWithProfile[]> {
  const { data, error } = await supabase.rpc('list_workspace_members', { target_workspace_id: workspaceId })
  if (error) throw error
  return data
}

/** UX-14.5 Phase 3 — role change, gated by the existing Phase 1 owner-only UPDATE policy; no new RLS needed. */
export async function updateWorkspaceMemberRole(
  membershipId: string,
  role: Exclude<WorkspaceMemberRole, 'owner'>,
): Promise<WorkspaceMember> {
  const { data, error } = await supabase.from('workspace_members').update({ role }).eq('id', membershipId).select().single()
  if (error) throw error
  return data
}

/**
 * UX-14.5 Phase 3 — removal is a soft status change, not a delete: the
 * `removed` status already exists in Phase 1's enum specifically for
 * this, and keeping the row preserves `invited_by`/`created_at` history
 * and lets `inviteToWorkspace`'s upsert re-invite the same person later
 * without hitting the (workspace_id, user_id) unique constraint. Gated
 * by the existing Phase 1 owner-only UPDATE policy; no new RLS needed.
 */
export async function removeWorkspaceMember(membershipId: string): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from('workspace_members')
    .update({ status: 'removed' })
    .eq('id', membershipId)
    .select()
    .single()
  if (error) throw error
  return data
}
