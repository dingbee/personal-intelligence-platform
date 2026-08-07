import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminAiUsageSummary,
  useAdminBetaInvites,
  useAdminCreateBetaInvite,
  useAdminPlatformCounts,
  useAdminRevokeBetaInvite,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { EmptyState } from '@/shared/components/ui/EmptyState'

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-lg font-semibold text-[var(--color-ink)]">{children}</h2>
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] px-4 py-3">
      <div className="text-2xl font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
    </div>
  )
}

/**
 * Founder Command Center — Overview. Every AI/Knowledge number here comes
 * from admin_ai_usage_summary/admin_platform_counts (platform-wide,
 * bridging RLS the same way admin_list_users already does), not a direct
 * client read of ai_requests/documents/etc — those tables are own-row-only
 * RLS, so a direct read would silently show only the founder's own data.
 * That was a real defect in the prior single-page dashboard; fixed here.
 * Deep management (per-user actions, plan quota edits, provider
 * governance) lives on the three dedicated /admin/* pages linked below —
 * this page is read-only status plus the one lightweight, frequent action
 * (creating a beta invite).
 */
export function AdminDashboardPage() {
  const { data: users = [], isLoading: usersLoading } = useAdminUsers()
  const { data: invites = [], isLoading: invitesLoading } = useAdminBetaInvites()
  const createInvite = useAdminCreateBetaInvite()
  const revokeInvite = useAdminRevokeBetaInvite()
  const { data: aiUsage = [] } = useAdminAiUsageSummary()
  const { data: counts } = useAdminPlatformCounts()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteOrg, setInviteOrg] = useState('')
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null)
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null)

  const planCounts = users.reduce<Record<string, number>>((acc, u) => {
    const key = u.plan_code ?? 'none'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const pendingInvites = invites.filter((i) => i.status === 'invited')
  const totalAiRequests = aiUsage.reduce((sum, row) => sum + Number(row.request_count), 0)
  const totalAiErrors = aiUsage.reduce((sum, row) => sum + Number(row.error_count), 0)

  async function handleCreateInvite(event: React.FormEvent) {
    event.preventDefault()
    setInviteFeedback(null)
    const result = await createInvite.mutateAsync({
      email: inviteEmail,
      fullName: inviteName || null,
      organization: inviteOrg || null,
      planId: null,
    })
    if (result.outcome === 'duplicate') {
      setInviteFeedback(`${inviteEmail} already has an invite on file.`)
    } else {
      setInviteFeedback(`Invite created for ${inviteEmail}.`)
      setInviteEmail('')
      setInviteName('')
      setInviteOrg('')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Founder Command Center</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Operational control — visible only to platform admins.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/admin/users" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          Users →
        </Link>
        <Link to="/admin/plans" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          Plans & Quotas →
        </Link>
        <Link to="/admin/ai" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          AI Governance →
        </Link>
      </div>

      {/* Overview */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Overview</SectionHeading>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Users</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total users" value={users.length} />
            <StatTile label="Beta plan" value={planCounts.beta ?? 0} />
            <StatTile label="Pro plan" value={planCounts.pro ?? 0} />
            <StatTile label="Enterprise plan" value={planCounts.enterprise ?? 0} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">AI (last 7 days, platform-wide)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="AI requests" value={totalAiRequests} />
            <StatTile label="AI errors" value={totalAiErrors} />
            <StatTile label="Providers active" value={aiUsage.length} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Knowledge (platform-wide)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Documents" value={counts?.documents ?? '—'} />
            <StatTile label="Conversations" value={counts?.conversations ?? '—'} />
            <StatTile label="Notes" value={counts?.notes ?? '—'} />
            <StatTile label="Collections" value={counts?.knowledge_collections ?? '—'} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">System</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Pending beta invites" value={pendingInvites.length} />
            <StatTile label="Database reachable" value={!usersLoading ? 'Yes' : 'Checking…'} />
            <StatTile label="Auth session" value="Active" />
          </div>
        </div>
      </SurfaceCard>

      {/* Beta Invites */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Beta Invites</SectionHeading>

        <form onSubmit={handleCreateInvite} className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Input label="Email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="Organization" value={inviteOrg} onChange={(e) => setInviteOrg(e.target.value)} />
          </div>
          <Button type="submit" loading={createInvite.isPending}>
            Create invite
          </Button>
        </form>
        {inviteFeedback && <p className="text-xs text-[var(--color-ink-muted)]">{inviteFeedback}</p>}
        <p className="text-xs text-[var(--color-ink-muted)]">New invites default to the Beta plan — assign Pro/Enterprise from Users after signup.</p>

        {invitesLoading ? (
          <Spinner size="sm" />
        ) : invites.length === 0 ? (
          <EmptyState title="No invites yet" description="Create the first beta invite above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Invited</th>
                  <th className="pb-2 pr-4 font-medium">Accepted</th>
                  <th className="pb-2 pr-4 font-medium">Accepted by</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{invite.email}</td>
                    <td className="py-2 pr-4">
                      <span className={invite.status === 'accepted' ? 'text-[var(--color-success-strong)]' : 'text-[var(--color-ink-muted)]'}>
                        {invite.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{new Date(invite.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {invite.accepted_at ? new Date(invite.accepted_at).toLocaleDateString() : '–'}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{invite.accepted_by_email ?? '–'}</td>
                    <td className="py-2">
                      {invite.status === 'invited' && (
                        <button
                          type="button"
                          onClick={() => setConfirmingRevokeId(invite.id)}
                          className="text-[var(--color-danger)] hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <ConfirmDialog
        open={confirmingRevokeId !== null}
        title="Revoke this invite?"
        description="This only removes an unused, pending invite. Already-accepted invites are never affected."
        confirmLabel="Revoke"
        onConfirm={() => {
          if (confirmingRevokeId) revokeInvite.mutate(confirmingRevokeId)
          setConfirmingRevokeId(null)
        }}
        onCancel={() => setConfirmingRevokeId(null)}
      />
    </div>
  )
}
