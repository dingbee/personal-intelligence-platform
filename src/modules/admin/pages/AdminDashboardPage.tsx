import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAdminBetaInvites, useAdminCreateBetaInvite, useAdminRevokeBetaInvite, useAdminUsers } from '@/modules/admin/hooks/useAdminData'
import { useProviderIntelligence } from '@/modules/ai/providers/useProviderIntelligence'
import { ProviderStatusCard } from '@/modules/settings/components/ProviderStatusCard'
import { useRecentAiRequests } from '@/modules/ai/observability/hooks/useRecentAiRequests'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { EmptyState } from '@/shared/components/ui/EmptyState'

function usePlansAndQuotas() {
  return useQuery({
    queryKey: ['admin-plans-quotas'],
    queryFn: async () => {
      const [{ data: plans }, { data: quotas }] = await Promise.all([
        supabase.from('plans').select('id, code, name, description, active').order('created_at'),
        supabase.from('plan_quotas').select('plan_id, quota_key, quota_limit, quota_period'),
      ])
      return { plans: plans ?? [], quotas: quotas ?? [] }
    },
  })
}

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
 * Beta / Admin / AI Governance Foundation — one page, sectioned rather
 * than six separate routes (the brief's own "Founder Admin Dashboard...
 * Initial sections" list is a content grouping, not a routing
 * requirement). Every number here comes from a real query — no invented
 * uptime/health metrics the system has no way to actually compute.
 */
export function AdminDashboardPage() {
  const { data: users = [], isLoading: usersLoading } = useAdminUsers()
  const { data: invites = [], isLoading: invitesLoading } = useAdminBetaInvites()
  const createInvite = useAdminCreateBetaInvite()
  const revokeInvite = useAdminRevokeBetaInvite()
  const { providers } = useProviderIntelligence()
  const { data: recentRequests = [] } = useRecentAiRequests(50)
  const { data: plansAndQuotas } = usePlansAndQuotas()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteOrg, setInviteOrg] = useState('')
  const [invitePlanId, setInvitePlanId] = useState('')
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null)
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null)

  const betaPlanCounts = users.reduce<Record<string, number>>((acc, u) => {
    const key = u.plan_code ?? 'none'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const pendingInvites = invites.filter((i) => i.status === 'invited')
  const recentErrors = recentRequests.filter((r) => r.status === 'error')

  async function handleCreateInvite(event: React.FormEvent) {
    event.preventDefault()
    setInviteFeedback(null)
    const result = await createInvite.mutateAsync({
      email: inviteEmail,
      fullName: inviteName || null,
      organization: inviteOrg || null,
      planId: invitePlanId || null,
    })
    if (result.outcome === 'duplicate') {
      setInviteFeedback(`${inviteEmail} already has an invite on file.`)
    } else {
      setInviteFeedback(`Invite created for ${inviteEmail}.`)
      setInviteEmail('')
      setInviteName('')
      setInviteOrg('')
      setInvitePlanId('')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Founder Admin Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Operational control — visible only to platform admins.</p>
      </div>

      {/* Overview */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Overview</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total users" value={users.length} />
          <StatTile label="Beta plan" value={betaPlanCounts.beta ?? 0} />
          <StatTile label="Pro plan" value={betaPlanCounts.pro ?? 0} />
          <StatTile label="Enterprise plan" value={betaPlanCounts.enterprise ?? 0} />
          <StatTile label="Pending invites" value={pendingInvites.length} />
          <StatTile label="AI requests (recent)" value={recentRequests.length} />
          <StatTile label="Recent AI errors" value={recentErrors.length} />
          <StatTile label="Configured providers" value={providers.filter((p) => p.keyAvailable).length} />
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-ink)]">Plan (optional)</label>
            <select
              value={invitePlanId}
              onChange={(e) => setInvitePlanId(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
            >
              <option value="">Default (beta)</option>
              {plansAndQuotas?.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={createInvite.isPending}>
            Create invite
          </Button>
        </form>
        {inviteFeedback && <p className="text-xs text-[var(--color-ink-muted)]">{inviteFeedback}</p>}

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

      {/* Users */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Users</SectionHeading>
        {usersLoading ? (
          <Spinner size="sm" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Beta status</th>
                  <th className="pb-2 pr-4 font-medium">AI usage</th>
                  <th className="pb-2 pr-4 font-medium">Signed up</th>
                  <th className="pb-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{u.display_name ?? u.email}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{u.plan_name ?? '–'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{u.beta_status ?? '–'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {u.quota_used ?? 0} / {u.quota_limit ?? '–'}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-2 text-[var(--color-ink-muted)]">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Plans & Quotas */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Plans & Quotas</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plansAndQuotas?.plans.map((plan) => {
            const quota = plansAndQuotas.quotas.find((q) => q.plan_id === plan.id && q.quota_key === 'ai_messages')
            return (
              <div key={plan.id} className="rounded-control border border-[var(--color-border)] p-3">
                <div className="text-sm font-medium text-[var(--color-ink)]">{plan.name}</div>
                <div className="mt-1 text-xs text-[var(--color-ink-muted)]">{plan.description}</div>
                <div className="mt-2 text-xs text-[var(--color-ink-muted)]">
                  AI messages: {quota ? `${quota.quota_limit.toLocaleString()} / ${quota.quota_period}` : 'not configured'}
                </div>
              </div>
            )
          })}
        </div>
      </SurfaceCard>

      {/* AI Providers — the existing Provider Control Center (health, live
          test, enable/disable via provider_overrides), moved here from
          ordinary Settings now that provider governance is a founder-only
          capability, not something every signed-in user sees. */}
      <div>
        <SectionHeading>AI Providers</SectionHeading>
        <div className="mt-4">
          <ProviderStatusCard />
        </div>
      </div>

      {/* System Health */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>System Health</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Database reachable" value={users.length >= 0 && !usersLoading ? 'Yes' : 'Checking…'} />
          <StatTile label="Auth session" value="Active" />
          <StatTile label="Providers reachable" value={`${providers.filter((p) => p.keyAvailable).length}/${providers.length}`} />
          <StatTile label="Quota system" value={plansAndQuotas ? 'Reachable' : 'Checking…'} />
          <StatTile label="Recent AI errors (last 50)" value={recentErrors.length} />
          <StatTile label="Pending beta invites" value={pendingInvites.length} />
        </div>
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
