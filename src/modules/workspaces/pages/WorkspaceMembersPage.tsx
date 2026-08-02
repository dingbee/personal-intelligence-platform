import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useWorkspaceRole } from '@/modules/workspaces/hooks/useWorkspaceRole'
import { useWorkspaceMembers } from '@/modules/workspaces/hooks/useWorkspaceMembers'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { MemberAvatar } from '@/shared/components/collaboration/MemberAvatar'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { WorkspaceMemberRole } from '@/shared/types/database'

const ASSIGNABLE_ROLES: Exclude<WorkspaceMemberRole, 'owner'>[] = ['editor', 'viewer']

/**
 * UX-14.5 Phase 3 — the Workspace Settings page for member
 * administration. Viewing the roster is open to any member (mirrors
 * workspace_members' own Phase 1 SELECT policy); inviting, changing a
 * role, or removing someone is gated to `isOwner` so the UI never
 * offers a control the RLS/RPC layer would reject. A member's own row
 * is never actionable here (no self-remove/self-demote) — deliberately
 * out of scope: the workspace's creator falls back to implicit owner
 * via `workspaces.user_id` regardless, so "removing yourself" would be
 * either a no-op or a confusing partial state, not a real capability.
 */
export function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { user } = useAuth()
  const { workspaces } = useWorkspace()
  const { data: role } = useWorkspaceRole(workspaceId ?? null)
  const { data: members = [], isLoading, invite, changeRole, remove } = useWorkspaceMembers(workspaceId!)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceMemberRole, 'owner'>>('editor')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const workspace = workspaces.find((w) => w.id === workspaceId)
  const isOwner = role === 'owner'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/settings/workspaces"
          className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          ← Back to Workspaces
        </Link>
        <div className="mt-2">
          <SectionHeader
            level="page"
            title={workspace ? `${workspace.name} — Members` : 'Members'}
            description="Everyone with access to this workspace, and their role."
          />
        </div>
      </div>

      {isOwner && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!inviteEmail.trim()) return
            invite.mutate({ email: inviteEmail.trim(), role: inviteRole }, { onSuccess: () => setInviteEmail('') })
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
          {invite.isError && (
            <p className="w-full text-sm text-red-600">
              {invite.error instanceof Error ? invite.error.message : 'Failed to send invitation'}
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
                      className="text-red-600 hover:text-red-700"
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
    </div>
  )
}
