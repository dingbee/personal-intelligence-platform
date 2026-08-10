import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminApproveFoundingProApplication,
  useAdminFoundingProApplications,
  useAdminFoundingProEvents,
  useAdminFoundingProMembers,
  useAdminRejectFoundingProApplication,
} from '@/modules/admin/hooks/useAdminData'
import { useFoundingProCapacity } from '@/modules/founding-pro/hooks/useFoundingProCapacity'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { UsageIndicator } from '@/modules/billing/components/UsageIndicator'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency })
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'text-[var(--color-warning-strong)]',
  approved: 'text-[var(--color-accent)]',
  rejected: 'text-[var(--color-danger)]',
  withdrawn: 'text-[var(--color-ink-muted)]',
  enrolled: 'text-[var(--color-success-strong)]',
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`capitalize ${STATUS_CLASSES[status] ?? 'text-[var(--color-ink-muted)]'}`}>{status}</span>
}

/**
 * Founding Pro Programme Phase 3 — the admin operational surface. Every
 * read and mutation goes through the admin_list_founding_pro_applications/
 * _members/_events, admin_approve_founding_pro_application, and
 * admin_reject_founding_pro_application RPCs (0054), each re-checking
 * is_platform_admin() server-side — this page performs no direct table
 * reads/writes and no client-side-only authorization check.
 *
 * Approval/rejection here only ever move an application between 'pending'
 * and 'approved'/'rejected'. Neither assigns founding_pro, consumes a
 * public slot, or creates a membership row — enrollment (the actual slot
 * reservation) remains a separate, later operation. The public 100-slot
 * capacity figure comes exclusively from get_founding_pro_public_capacity
 * (the same source PricingPage/FoundingProCard already use) — "Total
 * Founding Pro members" and "Grandfathered members" below are simple counts
 * over the admin-authorized member list this page already has in full, not
 * a re-derivation of the official public capacity number.
 */
export function AdminFoundingProPage() {
  const { data: capacity } = useFoundingProCapacity()
  const { data: applications = [], isLoading: applicationsLoading } = useAdminFoundingProApplications()
  const { data: members = [], isLoading: membersLoading } = useAdminFoundingProMembers()
  const { data: events = [], isLoading: eventsLoading } = useAdminFoundingProEvents()
  const approve = useAdminApproveFoundingProApplication()
  const reject = useAdminRejectFoundingProApplication()

  const [confirming, setConfirming] = useState<{ id: string; applicant: string; action: 'approve' | 'reject' } | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const pendingApplications = applications.filter((a) => a.status === 'pending')
  const grandfatheredMembers = members.filter((m) => m.slot_type === 'grandfathered')

  function handleConfirm() {
    if (!confirming) return
    const target = confirming
    setStatus(null)
    const mutation = target.action === 'approve' ? approve : reject
    mutation.mutate(
      { applicationId: target.id },
      {
        onSuccess: () =>
          setStatus({ type: 'success', message: `Application for ${target.applicant} was ${target.action === 'approve' ? 'approved' : 'rejected'}.` }),
        onError: (err) =>
          setStatus({ type: 'error', message: errorMessage(err, `Failed to ${target.action} this application. Please try again.`) }),
      },
    )
    setConfirming(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Founding Pro Programme</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Review applications, track programme capacity, and manage the Founding Pro member registry.
        </p>
      </div>

      {status && (
        <p
          role={status.type === 'error' ? 'alert' : undefined}
          className={`text-xs ${status.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}
        >
          {status.message}
        </p>
      )}

      {/* Programme overview / capacity */}
      <SurfaceCard className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Programme Overview</h2>
        {capacity ? (
          <>
            <div>
              <p className="text-2xl font-semibold text-[var(--color-ink)]">
                {capacity.remainingPublicSlots} / {capacity.maxPublicSlots} Founding Pro places remaining
              </p>
              <div className="mt-3 max-w-md">
                <UsageIndicator label="Public places claimed" used={capacity.enrolledPublicCount} limit={capacity.maxPublicSlots} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Public places claimed" value={capacity.enrolledPublicCount} variant="inset" />
              <StatCard label="Public places remaining" value={capacity.remainingPublicSlots} variant="inset" />
              <StatCard label="Grandfathered members" value={grandfatheredMembers.length} variant="inset" />
              <StatCard label="Total Founding Pro members" value={members.length} variant="inset" />
            </div>
          </>
        ) : (
          <Spinner size="sm" />
        )}
      </SurfaceCard>

      {/* Applications queue */}
      <SurfaceCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Applications</h2>
          {pendingApplications.length > 0 && (
            <span className="rounded-full bg-[var(--color-warning-strong)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-warning-strong)]">
              {pendingApplications.length} pending review
            </span>
          )}
        </div>

        {applicationsLoading ? (
          <Spinner size="sm" />
        ) : applications.length === 0 ? (
          <EmptyState title="No applications yet" description="Founding Pro applications will appear here once submitted." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Applicant</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Submitted</th>
                  <th className="pb-2 pr-4 font-medium">Reviewed</th>
                  <th className="pb-2 pr-4 font-medium">Reviewer</th>
                  <th className="pb-2 pr-4 font-medium">Membership</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{app.applicant_name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{app.applicant_email ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(app.submitted_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(app.reviewed_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{app.reviewer_email ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {app.member_number != null
                        ? `Founding Member #${app.member_number}`
                        : app.member_id
                          ? 'Grandfathered'
                          : '—'}
                    </td>
                    <td className="py-2">
                      {app.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirming({ id: app.id, applicant: app.applicant_email ?? app.applicant_name ?? 'this applicant', action: 'approve' })}
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming({ id: app.id, applicant: app.applicant_email ?? app.applicant_name ?? 'this applicant', action: 'reject' })}
                            className="text-[var(--color-danger)] hover:underline"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[var(--color-ink-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Member registry */}
      <SurfaceCard className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Founding Pro Members</h2>

        {membersLoading ? (
          <Spinner size="sm" />
        ) : members.length === 0 ? (
          <EmptyState title="No Founding Pro members yet" description="Enrolled members will appear here once applications are approved and enrolled." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">Member</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Price</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">Expires</th>
                  <th className="pb-2 pr-4 font-medium">Transition</th>
                  <th className="pb-2 font-medium">Current plan</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{m.founding_member_number ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{m.applicant_name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{m.applicant_email ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={m.slot_type === 'public' ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)]'}>
                        {m.slot_type === 'public' ? 'Public Founding Member' : 'Grandfathered'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatPrice(m.founding_price_cents, m.currency)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(m.founding_started_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(m.founding_expires_at)}</td>
                    <td className="py-2 pr-4 capitalize text-[var(--color-ink-muted)]">{m.transition_status}</td>
                    <td className="py-2 text-[var(--color-ink-muted)]">{m.current_plan_code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Audit / lifecycle history */}
      <SurfaceCard>
        <details>
          <summary className="cursor-pointer text-lg font-semibold text-[var(--color-ink)]">Lifecycle History</summary>
          <div className="mt-4">
            {eventsLoading ? (
              <Spinner size="sm" />
            ) : events.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-muted)]">No events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)]">
                      <th className="pb-2 pr-4 font-medium">Event</th>
                      <th className="pb-2 pr-4 font-medium">Actor</th>
                      <th className="pb-2 pr-4 font-medium">Target</th>
                      <th className="pb-2 pr-4 font-medium">When</th>
                      <th className="pb-2 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id} className="border-t border-[var(--color-border)] align-top">
                        <td className="py-2 pr-4 capitalize text-[var(--color-ink)]">{ev.event_type.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{ev.actor_email ?? '—'}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{ev.target_email ?? '—'}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(ev.created_at)}</td>
                        <td className="py-2 text-[10px] text-[var(--color-ink-muted)]">
                          {ev.metadata && Object.keys(ev.metadata).length > 0 ? JSON.stringify(ev.metadata) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </SurfaceCard>

      <ConfirmDialog
        open={confirming !== null}
        title={confirming?.action === 'approve' ? 'Approve this application?' : 'Reject this application?'}
        description={
          confirming?.action === 'approve'
            ? `${confirming.applicant}'s application will move to Approved. This does not enroll them as a Founding Pro member, assign a slot, or send an invitation — enrollment remains a separate step.`
            : `${confirming?.applicant}'s application will move to Rejected.`
        }
        confirmLabel={confirming?.action === 'approve' ? 'Approve' : 'Reject'}
        destructive={confirming?.action === 'reject'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
