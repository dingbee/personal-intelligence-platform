import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminPlansAndQuotas, useAdminUpdatePlanQuota } from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Quota limits are edited through admin_update_plan_quota (SECURITY
 * DEFINER, admin_platform_admin()-checked) — plan_quotas has no client
 * write policy at all (0034_beta_invite_quota_repair.sql), so there is
 * no direct-table-write path here even for a founder. Assigning an
 * individual user to a different plan lives on the Users page, not
 * here — this page is the plan catalog itself, not a per-user action.
 */
export function AdminPlansPage() {
  const { data, isLoading } = useAdminPlansAndQuotas()
  const updateQuota = useAdminUpdatePlanQuota()

  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null)
  const [draftLimit, setDraftLimit] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  function startEdit(quotaId: string, currentLimit: number) {
    setEditingQuotaId(quotaId)
    setDraftLimit(String(currentLimit))
    setFeedback(null)
  }

  async function saveEdit(planId: string, quotaKey: string) {
    const parsed = Number(draftLimit)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFeedback('Enter a non-negative number.')
      return
    }
    await updateQuota.mutateAsync({ planId, quotaKey, quotaLimit: parsed })
    setFeedback('Quota limit updated.')
    setEditingQuotaId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Plans & Quotas</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          The plan catalog and its quota limits. To move an individual user onto a different plan, use{' '}
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
          {data?.plans.map((plan) => (
            <SurfaceCard key={plan.id} className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-ink)]">{plan.name}</div>
                <div className="text-xs text-[var(--color-ink-muted)]">{plan.code}</div>
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
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={draftLimit}
                            onChange={(e) => setDraftLimit(e.target.value)}
                            className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                          />
                          <button
                            type="button"
                            disabled={updateQuota.isPending}
                            onClick={() => saveEdit(plan.id, quota.quota_key)}
                            className="text-[var(--color-accent)] hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingQuotaId(null)} className="text-[var(--color-ink-muted)] hover:underline">
                            Cancel
                          </button>
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
          ))}
        </div>
      )}

      {feedback && <p className="text-xs text-[var(--color-ink-muted)]">{feedback}</p>}
    </div>
  )
}
