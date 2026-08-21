import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminAiUsageSummary,
  useAdminBetaInvites,
  useAdminCommercialOverview,
  useAdminCreateBetaInvite,
  useAdminPlansAndQuotas,
  useAdminPlatformCounts,
  useAdminRevokeBetaInvite,
  useAdminSendBetaInvitationEmail,
  useAdminSystemHealthSummary,
  useAdminUsageOverview,
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
  const { data: users = [] } = useAdminUsers()
  const { data: invites = [], isLoading: invitesLoading } = useAdminBetaInvites()
  const { data: plansAndQuotas } = useAdminPlansAndQuotas()
  const createInvite = useAdminCreateBetaInvite()
  const sendInviteEmail = useAdminSendBetaInvitationEmail()
  const revokeInvite = useAdminRevokeBetaInvite()
  const { data: aiUsage = [] } = useAdminAiUsageSummary()
  const { data: counts } = useAdminPlatformCounts()
  const { data: commercial } = useAdminCommercialOverview()
  const { data: usage } = useAdminUsageOverview()
  const { data: healthSummary } = useAdminSystemHealthSummary()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteOrg, setInviteOrg] = useState('')
  const [invitePlanId, setInvitePlanId] = useState('')
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
    // A deliberately required choice, not an optional one defaulting to
    // null: assign_default_plan() (0044_commercial_schema_reconciliation.sql)
    // falls back to the literal `beta` plan when an invite carries no
    // plan_id — a pre-existing DB function this workstream leaves
    // untouched (unnecessary migration, and beta's own quotas must stay
    // intact for existing Beta users). Requiring an explicit choice here
    // is what actually stops this form from ever creating a new
    // Beta-plan customer, without altering that function.
    if (!invitePlanId) {
      setInviteFeedback('Choose a plan for this invite.')
      return
    }
    const result = await createInvite.mutateAsync({
      email: inviteEmail,
      fullName: inviteName || null,
      organization: inviteOrg || null,
      planId: invitePlanId,
    })
    if (result.outcome === 'duplicate') {
      setInviteFeedback(`${inviteEmail} already has an invite on file.`)
      return
    }
    setInviteEmail('')
    setInviteName('')
    setInviteOrg('')
    setInvitePlanId('')
    // PIP Stabilization v1 (P1) — invite-row creation and email delivery are
    // reported as two distinct facts: a database row existing was never
    // proof the invitee was told anything. If invite_id is missing (should
    // not happen for a 'created' outcome, but the RPC's return type allows
    // it) there is nothing to email, so say so rather than silently trying.
    if (!result.invite_id) {
      setInviteFeedback(`Invite created for ${inviteEmail}, but no invite id was returned — email not sent.`)
      return
    }
    setInviteFeedback(`Invite created for ${inviteEmail}. Sending invitation email…`)
    const { error } = await sendInviteEmail.mutateAsync(result.invite_id)
    if (error) {
      setInviteFeedback(`Invite created for ${inviteEmail}, but the invitation email failed to send: ${error}`)
    } else {
      setInviteFeedback(`Invite created and invitation email sent to ${inviteEmail}.`)
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
          Plans & Commercial →
        </Link>
        <Link to="/admin/ai" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          AI Governance →
        </Link>
        <Link to="/admin/founding-pro" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          Founding Pro →
        </Link>
        <Link to="/admin/billing" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          Billing & Subscriptions →
        </Link>
        <Link to="/admin/usage" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          Usage & Quotas →
        </Link>
        <Link to="/admin/system-health" className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--surface-inset)]">
          System Health →
        </Link>
      </div>

      {/* Overview */}
      <SurfaceCard className="flex flex-col gap-4">
        <SectionHeading>Overview</SectionHeading>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Users</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total users" value={users.length} />
            <StatTile label="Free" value={planCounts.free ?? 0} />
            <StatTile label="Student" value={planCounts.student ?? 0} />
            <StatTile label="Pro" value={planCounts.pro ?? 0} />
            <StatTile label="Founding Pro" value={planCounts.founding_pro ?? 0} />
            <StatTile label="Enterprise" value={planCounts.enterprise ?? 0} />
            <StatTile label="Legacy Beta" value={planCounts.beta ?? 0} />
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Pending access invites" value={pendingInvites.length} />
            <StatTile label="Open critical events" value={healthSummary?.open_critical ?? '–'} />
            <StatTile label="Open error events" value={healthSummary?.open_error ?? '–'} />
            <StatTile label="Unresolved events" value={healthSummary?.unresolved ?? '–'} />
          </div>
        </div>
      </SurfaceCard>

      {/* Commercial — active/pending/failed/cancelled subscriptions and Founding Pro lifecycle counts, sourced from admin_commercial_overview (read-only over the existing Pesapal/apply_subscription_event architecture; see AdminBillingPage's own header comment). */}
      <SurfaceCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionHeading>Commercial</SectionHeading>
          <Link to="/admin/billing" className="text-xs text-[var(--color-accent)] hover:underline">
            Billing & Subscriptions →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Active subscriptions" value={commercial?.active_subscriptions ?? '–'} />
          <StatTile label="Pending checkouts" value={commercial?.pending_checkout_orders ?? '–'} />
          <StatTile label="Failed checkouts (30d)" value={commercial?.failed_checkout_orders_30d ?? '–'} />
          <StatTile label="Cancelled" value={commercial?.cancelled_subscriptions ?? '–'} />
          <StatTile label="Founding Pro active" value={commercial?.founding_pro_active ?? '–'} />
          <StatTile label="Founding Pro expiring (30d)" value={commercial?.founding_pro_expiring_30d ?? '–'} />
          <StatTile label="Plan transitions (30d)" value={commercial?.recent_transitions_30d ?? '–'} />
          <StatTile label="Billing inconsistencies (30d)" value={commercial?.failed_subscription_events_30d ?? '–'} />
        </div>
      </SurfaceCard>

      {/* Usage & Collaboration — quota exhaustion/unusual consumption and workspace collaboration health, sourced from admin_usage_overview. */}
      <SurfaceCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionHeading>Usage & Collaboration</SectionHeading>
          <Link to="/admin/usage" className="text-xs text-[var(--color-accent)] hover:underline">
            Usage & Quotas →
          </Link>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Usage</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="At 100% this month" value={usage?.exhausted_count ?? '–'} />
            <StatTile label="Over 90%" value={usage?.over_90_count ?? '–'} />
            <StatTile label="Over 75%" value={usage?.over_75_count ?? '–'} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-ink-muted)]">Collaboration</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Active collaborators" value={usage?.active_collaborators ?? '–'} />
            <StatTile label="Pending invitations" value={usage?.pending_invitations ?? '–'} />
            <StatTile label="Expired pending invitations" value={usage?.expired_pending_invitations ?? '–'} />
          </div>
        </div>
      </SurfaceCard>

      {/*
        Access Invites — this admin-grants a signup authorization
        (is_beta_invited()), one of two ways a new account can now be
        created since 0069_collaboration_invitation_signup_authorization.
        sql — the other is a valid pending workspace invitation, which
        this panel has no visibility into (see WorkspaceMemberRoster for
        that). Not a Founding-Pro-specific tool. It predates and is
        architecturally distinct from the dedicated
        Founding Pro Programme application/review/enrollment flow at
        /admin/founding-pro (self-service application -> admin approval
        -> priced invitation -> acceptance), which already implements
        Founding Pro's own request/review/grant pipeline in full and is
        not duplicated here. Renamed away from "Beta Invites" (Beta is
        retired as a customer-facing plan) and no longer silently
        defaults a new invite to the Beta plan (beta_invites.plan_id has
        always supported an explicit target plan — admin_create_beta_invite
        already accepted it; only this form never exposed it). An admin
        can still grant Founding Pro directly through an invite here when
        that's the right tool (e.g. a person already agreed with outside
        the public application flow); the applications queue on the
        Founding Pro Programme page remains the primary path for
        self-service applicants.
      */}
      <SurfaceCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionHeading>Access Invites</SectionHeading>
          <Link to="/admin/founding-pro" className="text-xs text-[var(--color-accent)] hover:underline">
            Founding Pro Programme →
          </Link>
        </div>

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
          <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)]">
            Plan on signup
            <select
              required
              value={invitePlanId}
              onChange={(e) => setInvitePlanId(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1.5 text-sm text-[var(--color-ink)]"
            >
              <option value="">Choose plan…</option>
              {plansAndQuotas?.plans
                .filter((plan) => plan.code !== 'beta')
                .map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" loading={createInvite.isPending}>
            Create invite
          </Button>
        </form>
        {inviteFeedback && <p className="text-xs text-[var(--color-ink-muted)]">{inviteFeedback}</p>}
        <p className="text-xs text-[var(--color-ink-muted)]">
          Grants access to sign up and assigns the chosen plan. Beta is retired — no invite created here assigns it.
        </p>

        {invitesLoading ? (
          <Spinner size="sm" />
        ) : invites.length === 0 ? (
          <EmptyState title="No invites yet" description="Create the first invite above." />
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
