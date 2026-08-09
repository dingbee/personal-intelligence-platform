import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminPlansAndQuotas, useAdminUpdatePlanQuota, useAdminUsers } from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * ARRIYIA Quota Administration Remediation. Quota limits are edited
 * through admin_update_plan_quota (SECURITY DEFINER,
 * is_platform_admin()-checked) — plan_quotas has no client write policy
 * at all (0034_beta_invite_quota_repair.sql), so there is no
 * direct-table-write path here even for a founder.
 *
 * This is a PLAN-WIDE control, not a per-user one — the incident this
 * remediates was exactly that ambiguity: editing a plan's quota here
 * changes the number for every user on that plan simultaneously, which
 * is easy to mistake for a single-user action if the scope isn't stated
 * plainly. Every edit shows the plan-wide warning and the live count of
 * affected users, and requires an explicit confirmation before saving.
 * To give one specific user a different limit without affecting anyone
 * else, use the Users page's personal quota override instead.
 */
export function AdminPlansPage() {
  const { data, isLoading } = useAdminPlansAndQuotas()
  const { data: users = [] } = useAdminUsers()
  const updateQuota = useAdminUpdatePlanQuota()

  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null)
  const [draftLimit, setDraftLimit] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pendingSave, setPendingSave] = useState<{
    planId: string
    planName: string
    quotaKey: string
    newLimit: number
    affectedUsers: number
  } | null>(null)

  function startEdit(quotaId: string, currentLimit: number) {
    setEditingQuotaId(quotaId)
    setDraftLimit(String(currentLimit))
    setStatus(null)
  }

  function requestSave(planId: string, planName: string, planCode: string, quotaKey: string) {
    const parsed = Number(draftLimit)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus({ type: 'error', message: 'Enter a non-negative number.' })
      return
    }
    setStatus(null)
    const affectedUsers = users.filter((u) => u.plan_code === planCode).length
    setPendingSave({ planId, planName, quotaKey, newLimit: parsed, affectedUsers })
  }

  async function confirmSave() {
    if (!pendingSave) return
    const { planId, quotaKey, newLimit } = pendingSave
    try {
      await updateQuota.mutateAsync({ planId, quotaKey, quotaLimit: newLimit })
      setStatus({ type: 'success', message: 'Quota limit updated for every user on this plan.' })
      setEditingQuotaId(null)
    } catch (err) {
      // Deliberately leaves editingQuotaId open — a failed save keeps the
      // draft visible instead of silently reverting to an
      // apparently-unchanged screen.
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to update the quota limit. Please try again.') })
    } finally {
      setPendingSave(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Plans & Quotas</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          The plan catalog and its quota limits. Changes here are plan-wide — they affect every user on that plan. To give
          one user a different limit, or move a user onto a different plan, use{' '}
          <Link to="/admin/users" className="text-[var(--color-accent)] hover:underline">
            Users
          </Link>
          .
        </p>
      </div>

      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data?.plans.map((plan) => {
            const affectedUsers = users.filter((u) => u.plan_code === plan.code).length
            return (
              <SurfaceCard key={plan.id} className="flex flex-col gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">{plan.name}</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">
                    {plan.code} · {affectedUsers} {affectedUsers === 1 ? 'user' : 'users'}
                  </div>
                  {plan.description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{plan.description}</p>}
                  {!plan.active && <p className="mt-1 text-xs text-[var(--color-danger)]">Inactive</p>}
                </div>

                <div className="flex flex-col gap-2">
                  {data.quotas
                    .filter((q) => q.plan_id === plan.id)
                    .map((quota) => (
                      <div key={quota.id} className="rounded-control border border-[var(--color-border)] p-2">
                        <div className="text-xs font-medium text-[var(--color-ink)]">{quota.quota_key}</div>
                        {editingQuotaId === quota.id ? (
                          <div className="mt-1 flex flex-col gap-1">
                            <p className="rounded bg-[var(--surface-inset)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)]">
                              <strong className="text-[var(--color-ink)]">Plan-wide setting.</strong> This changes the quota
                              limit for every user assigned to this plan. Currently affects {affectedUsers}{' '}
                              {affectedUsers === 1 ? 'user' : 'users'}.
                            </p>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={draftLimit}
                                onChange={(e) => setDraftLimit(e.target.value)}
                                aria-label="Quota limit"
                                className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                              />
                              <button
                                type="button"
                                disabled={updateQuota.isPending}
                                onClick={() => requestSave(plan.id, plan.name, plan.code, quota.quota_key)}
                                className="text-[var(--color-accent)] hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingQuotaId(null)} className="text-[var(--color-ink-muted)] hover:underline">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(quota.id, quota.quota_limit)}
                            className="mt-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                          >
                            {quota.quota_limit.toLocaleString()} / {quota.quota_period} — edit
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </SurfaceCard>
            )
          })}
        </div>
      )}

      {status && (
        <p
          role={status.type === 'error' ? 'alert' : undefined}
          className={`text-xs ${status.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}
        >
          {status.message}
        </p>
      )}

      <ConfirmDialog
        open={pendingSave !== null}
        title="Change this plan's quota for everyone?"
        description={
          pendingSave
            ? `This sets ${pendingSave.planName}'s ${pendingSave.quotaKey} limit to ${pendingSave.newLimit.toLocaleString()} for all ${pendingSave.affectedUsers} ${pendingSave.affectedUsers === 1 ? 'user' : 'users'} currently on this plan. This does not affect any individual user's personal override.`
            : undefined
        }
        confirmLabel="Change for everyone"
        destructive
        onConfirm={confirmSave}
        onCancel={() => setPendingSave(null)}
      />
    </div>
  )
}
