import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMembers } from '@/modules/workspaces/hooks/useWorkspaceMembers'
import { useWorkspaceInvitations } from '@/modules/workspaces/hooks/useWorkspaceInvitations'
import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { MemberAvatar } from '@/shared/components/collaboration/MemberAvatar'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { WorkspaceMemberRole } from '@/shared/types/database'

const ASSIGNABLE_ROLES: Exclude<WorkspaceMemberRole, 'owner'>[] = ['editor', 'viewer']

/**
 * UX-14.5.7 — extracted from WorkspaceMembersPage (Phase 3) so the same
 * invite/roster/role-change/remove UI can be embedded both on the
 * standalone Settings page and on the new consolidated
 * WorkspaceCollaborationPage, rather than existing as two divergent
 * copies. Behavior unchanged: viewing is open to any member (mirrors
 * workspace_members' Phase 1 SELECT policy); inviting, changing a role,
 * or removing someone is gated to `isOwner` so the UI never offers a
 * control the RLS/RPC layer would reject. A member's own row is never
 * actionable here (no self-remove/self-demote) — see WorkspaceMembersPage's
 * original doc-comment for why that's deliberate, not an oversight.
 *
 * UX-14.5.8 Phase 1 — also renders "Pending Invitations"
 * (`workspace_invitations`, an email with no account yet — distinct from
 * the "Pending" `StatusBadge` below on an *active* row's roster entry,
 * which is a known user who hasn't accepted). The invite form itself no
 * longer distinguishes "known" from "unknown" email in any way the
 * owner can observe — both succeed identically, which closes the
 * account-enumeration side channel the discovery found as a direct
 * consequence of the redesign, not a separate fix.
 *
 * UX-14.5.8.2 — Cancel and Resend for a pending invitation.
 *
 * UX-14.5.8.3 — both the invite form and Resend now actually send an
 * email (via the `send-workspace-invitation` edge function). Delivery is
 * deliberately a second, non-corrupting step after invitation creation/
 * renewal already succeeded — see `useWorkspaceMembers`/
 * `useWorkspaceInvitations`' own doc-comments — so a delivery failure
 * surfaces as a distinct dismissible warning (`emailWarning`) rather
 * than `invite.isError`/a failed resend: the invitation is already
 * correctly pending in the database either way, and can be resent.
 *
 * V1 Free Collaboration — Free now has the collaboration feature itself
 * (`has_feature('collaboration')` is true for Free, Beta, Pro, Founding
 * Pro, and Enterprise; only a plan without the feature at all, e.g.
 * Student, sees the "not included" block below). What actually limits a
 * Free workspace is *capacity* — 1 active collaborator, 1 outstanding
 * invitation (`invite_to_workspace`'s own `max_active_collaborators`/
 * `max_pending_invitations` checks, 0071_free_access_and_collaboration.sql)
 * — enforced there, server-side, in the same transaction as the write.
 * This component's own capacity display (`activeCollaboratorCount`/
 * `pendingCount`, computed from data already loaded here) is advisory
 * only, exactly like the pre-existing `useHasFeature` read below: it
 * never grants or blocks anything by itself, and a stale/optimistic
 * client read here can never permit an invite the RPC would reject.
 */
export function WorkspaceMemberRoster({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: role } = useWorkspaceRole(workspaceId)
  const { data: members = [], isLoading, invite, changeRole, remove } = useWorkspaceMembers(workspaceId)
  const { data: invitations = [], isLoading: invitationsLoading, cancel, resend } = useWorkspaceInvitations(workspaceId)
  const { data: canCollaborate, isLoading: collaborationLoading } = useHasFeature('collaboration')

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceMemberRole, 'owner'>>('editor')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)

  const isOwner = role === 'owner'

  // Advisory only (see this component's own doc-comment) — computed from
  // data already loaded here, purely for presentation. The RPC re-derives
  // both counts itself, server-side, and is the only enforcement point.
  const activeCollaboratorCount = members.filter((m) => m.status === 'active' && m.role !== 'owner').length
  const pendingCount = members.filter((m) => m.status === 'pending').length + invitations.length

  // Capacity errors (invite_to_workspace's own controlled P0001 messages,
  // 0071_free_access_and_collaboration.sql) get a distinct, actionable
  // presentation — a plain red error line reads as a generic failure to
  // retry, not as "you're at your plan's limit," so this surfaces the
  // real reason with an upgrade path instead of a confusing generic error.
  const inviteErrorMessage = invite.error instanceof Error ? invite.error.message : invite.isError ? 'Failed to send invitation' : null
  const isCollaboratorLimitError = inviteErrorMessage?.includes('collaborator limit') ?? false
  const isPendingLimitError = inviteErrorMessage?.includes('outstanding invitation') ?? false

  return (
    <div className="flex flex-col gap-4">
      {isOwner && !collaborationLoading && !canCollaborate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Collaboration isn't included on your plan</p>
            <p className="text-xs text-[var(--color-ink-muted)]">Upgrade to invite editors and viewers to this workspace.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/pricing')}>
            Upgrade to Pro
          </Button>
        </div>
      )}

      {isOwner && canCollaborate && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!inviteEmail.trim()) return
            setEmailWarning(null)
            invite.mutate(
              { email: inviteEmail.trim(), role: inviteRole },
              {
                onSuccess: ({ emailError }) => {
                  setInviteEmail('')
                  if (emailError) setEmailWarning(`Invitation created, but the email failed to send: ${emailError}`)
                },
              },
            )
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Input
              label="Invite by email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-ink-muted)]">
            Role
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Exclude<WorkspaceMemberRole, 'owner'>)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-ink)]"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" loading={invite.isPending} disabled={!inviteEmail.trim()}>
            Invite
          </Button>
          <p className="w-full text-xs text-[var(--color-ink-muted)]">
            {activeCollaboratorCount} active collaborator{activeCollaboratorCount === 1 ? '' : 's'}
            {pendingCount > 0 && <> · {pendingCount} pending invitation{pendingCount === 1 ? '' : 's'}</>}
          </p>
          {invite.isError &&
            (isCollaboratorLimitError || isPendingLimitError ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
                <p className="text-sm text-[var(--color-ink)]">
                  {isCollaboratorLimitError
                    ? "You've reached the Free collaboration limit. Upgrade to Pro for expanded collaboration."
                    : inviteErrorMessage}
                </p>
                {isCollaboratorLimitError && (
                  <Button variant="secondary" onClick={() => navigate('/pricing')}>
                    Upgrade to Pro
                  </Button>
                )}
              </div>
            ) : (
              <p className="w-full text-sm text-[var(--color-danger)]">{inviteErrorMessage}</p>
            ))}
          {emailWarning && (
            <p className="w-full text-sm text-[var(--color-warning)]">
              {emailWarning}{' '}
              <button type="button" className="underline" onClick={() => setEmailWarning(null)}>
                Dismiss
              </button>
            </p>
          )}
        </form>
      )}

      {isLoading ? (
        <Spinner size="sm" />
      ) : members.length === 0 ? (
        <EmptyState title="No members yet" description="This workspace has no member roster." />
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((member) => {
            const isSelf = member.user_id === user?.id
            const canManage = isOwner && member.id !== null && !isSelf
            return (
              <div
                key={member.id ?? member.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar displayName={member.display_name} email={member.email} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {member.display_name || member.email}
                      {isSelf && <span className="ml-1.5 text-xs text-[var(--color-ink-muted)]">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-[var(--color-ink-muted)]">
                      {member.email} · Joined {formatRelativeTime(member.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {member.status === 'pending' && <StatusBadge label="Pending" variant="warning" />}
                  {canManage ? (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        changeRole.mutate({
                          membershipId: member.id!,
                          role: e.target.value as Exclude<WorkspaceMemberRole, 'owner'>,
                        })
                      }
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-ink)]"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge label={member.role} variant={member.role === 'owner' ? 'info' : 'neutral'} />
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      className="text-[var(--color-danger)] hover:text-[var(--color-danger-strong)]"
                      onClick={() => setRemovingId(member.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isOwner && (invitationsLoading || invitations.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Pending Invitations
          </p>
          {invitationsLoading ? (
            <Spinner size="sm" />
          ) : (
            invitations.map((invitation) => {
              const resending = resend.isPending && resend.variables?.email === invitation.email
              return (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-[var(--color-border)] bg-[var(--surface-inset)] p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">📧 {invitation.email}</p>
                    <p className="truncate text-xs text-[var(--color-ink-muted)]">
                      Invited {formatRelativeTime(invitation.created_at)}
                      {invitation.updated_at !== invitation.created_at && (
                        <> · Renewed {formatRelativeTime(invitation.updated_at)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge label={invitation.role} variant="neutral" />
                    <Button
                      variant="ghost"
                      loading={resending}
                      onClick={() => {
                        setEmailWarning(null)
                        resend.mutate(
                          { email: invitation.email, role: invitation.role },
                          {
                            onSuccess: ({ emailError }) => {
                              if (emailError) setEmailWarning(`Invitation renewed, but the email failed to send: ${emailError}`)
                            },
                          },
                        )
                      }}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-[var(--color-danger)] hover:text-[var(--color-danger-strong)]"
                      onClick={() => setCancelingId(invitation.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={removingId !== null}
        title="Remove this member?"
        description="They'll immediately lose access to this workspace's shared notes and content."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removingId) remove.mutate(removingId)
          setRemovingId(null)
        }}
        onCancel={() => setRemovingId(null)}
      />

      <ConfirmDialog
        open={cancelingId !== null}
        title="Cancel this invitation?"
        description="They won't gain access to this workspace if they sign up later. You can invite them again at any time."
        confirmLabel="Cancel invitation"
        onConfirm={() => {
          if (cancelingId) cancel.mutate(cancelingId)
          setCancelingId(null)
        }}
        onCancel={() => setCancelingId(null)}
      />
    </div>
  )
}
