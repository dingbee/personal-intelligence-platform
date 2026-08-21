import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminPlanQuotaPopulation,
  useAdminRemoveUserQuotaOverride,
  useAdminSetUserQuotaOverride,
  useAdminUsageOverview,
  useAdminUserQuotaBreakdown,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/** Never render a raw quota_key — same label set NotificationBell.tsx uses for the equivalent user-facing copy. */
const QUOTA_KEY_LABELS: Record<string, string> = {
  ai_messages: 'AI messages',
  data_intelligence_operations: 'Data Intelligence',
  analysis_intelligence_operations: 'Analysis Intelligence',
  research_intelligence_operations: 'Research Intelligence',
  decision_intelligence_operations: 'Decision Intelligence',
  planning_intelligence_operations: 'Planning Intelligence',
  action_intelligence_operations: 'Action Intelligence',
}

function quotaLabel(key: string): string {
  return QUOTA_KEY_LABELS[key] ?? key
}

function consumptionClass(percent: number): string {
  if (percent >= 100) return 'text-[var(--color-danger)] font-semibold'
  if (percent >= 90) return 'text-[var(--color-danger)]'
  if (percent >= 75) return 'text-[var(--color-warning,var(--color-accent))]'
  return 'text-[var(--color-ink-muted)]'
}

/**
 * #21 Phase 4.4 — Admin Usage & Quota Operations. Complements
 * AdminUsersPage (which already manages the ai_messages override inline per
 * row) and AdminPlansPage (plan-wide quota_limit policy) rather than
 * duplicating either: this page's job is the per-user breakdown ACROSS
 * every consumption-tracked quota_key — not just ai_messages — plus the
 * plan-level population view. Overrides still go through the exact same
 * admin_set_user_quota_override/admin_remove_user_quota_override RPCs
 * AdminUsersPage uses; this page only changes which quota_key they target.
 */
export function AdminUsageQuotasPage() {
  const { data: users = [] } = useAdminUsers()
  const { data: usageOverview } = useAdminUsageOverview()
  const { data: planPopulation = [], isLoading: planPopulationLoading } = useAdminPlanQuotaPopulation()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: breakdown = [], isLoading: breakdownLoading } = useAdminUserQuotaBreakdown(selectedUserId)
  const setOverride = useAdminSetUserQuotaOverride()
  const removeOverride = useAdminRemoveUserQuotaOverride()

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) ?? null, [users, selectedUserId])

  async function handleSetOverride(quotaKey: string) {
    if (!selectedUserId) return
    const raw = overrideDraft[quotaKey] ?? ''
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus({ type: 'error', message: 'Enter a non-negative number.' })
      return
    }
    setStatus(null)
    try {
      await setOverride.mutateAsync({ userId: selectedUserId, quotaKey, quotaLimit: parsed })
      setStatus({ type: 'success', message: `Override saved for ${quotaLabel(quotaKey)} — this affects only this user.` })
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to save the override. Please try again.') })
    }
  }

  async function handleRemoveOverride(quotaKey: string) {
    if (!selectedUserId) return
    setStatus(null)
    try {
      await removeOverride.mutateAsync({ userId: selectedUserId, quotaKey })
      setStatus({ type: 'success', message: `Override removed for ${quotaLabel(quotaKey)} — back to the plan default.` })
      setOverrideDraft((prev) => ({ ...prev, [quotaKey]: '' }))
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to remove the override. Please try again.') })
    }
  }

  const planPopulationByPlan = useMemo(() => {
    const grouped = new Map<string, { planName: string; rows: typeof planPopulation }>()
    for (const row of planPopulation) {
      const existing = grouped.get(row.plan_code)
      if (existing) existing.rows.push(row)
      else grouped.set(row.plan_code, { planName: row.plan_name, rows: [row] })
    }
    return grouped
  }, [planPopulation])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Usage & Quotas</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Per-user consumption across every intelligence operation family, plan-level policy and population, and per-user overrides —
          distinct from and never silently overwriting plan-wide quota_limit.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="At 100% this month" value={usageOverview?.exhausted_count ?? '–'} />
        <StatCard label="Over 90%" value={usageOverview?.over_90_count ?? '–'} />
        <StatCard label="Over 75%" value={usageOverview?.over_75_count ?? '–'} />
      </div>

      {status && (
        <p
          role={status.type === 'error' ? 'alert' : undefined}
          className={`text-xs ${status.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}
        >
          {status.message}
        </p>
      )}

      <SurfaceCard>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-ink-muted)] sm:max-w-sm">
          Select a user
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => {
              setSelectedUserId(e.target.value || null)
              setStatus(null)
            }}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
          >
            <option value="">Choose a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} — {u.plan_name ?? 'No plan'}
              </option>
            ))}
          </select>
        </label>

        {selectedUserId && (
          <div className="mt-4">
            {breakdownLoading ? (
              <Spinner size="sm" />
            ) : breakdown.length === 0 ? (
              <EmptyState
                title="No consumption-tracked quotas"
                description={`${selectedUser?.email ?? 'This user'} has no active plan assignment with quota keys to show.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)]">
                      <th className="pb-2 pr-4 font-medium">Quota</th>
                      <th className="pb-2 pr-4 font-medium">Plan default</th>
                      <th className="pb-2 pr-4 font-medium">Override</th>
                      <th className="pb-2 pr-4 font-medium">Effective</th>
                      <th className="pb-2 pr-4 font-medium">Used</th>
                      <th className="pb-2 pr-4 font-medium">%</th>
                      <th className="pb-2 pr-4 font-medium">Remaining</th>
                      <th className="pb-2 font-medium">Set override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => {
                      const remaining = Math.max(0, row.effective_limit - row.usage_count)
                      return (
                        <tr key={row.quota_key} className="border-t border-[var(--color-border)] align-top">
                          <td className="py-2 pr-4 text-[var(--color-ink)]">{quotaLabel(row.quota_key)}</td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{row.plan_limit}</td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                            {row.override_limit != null ? <span>{row.override_limit} · override</span> : 'None'}
                          </td>
                          <td className="py-2 pr-4 text-[var(--color-ink)]">{row.effective_limit}</td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{row.usage_count}</td>
                          <td className={`py-2 pr-4 ${consumptionClass(row.percent_used)}`}>{row.percent_used}%</td>
                          <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{remaining}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={overrideDraft[row.quota_key] ?? ''}
                                onChange={(e) => setOverrideDraft((prev) => ({ ...prev, [row.quota_key]: e.target.value }))}
                                placeholder="Limit"
                                aria-label={`${quotaLabel(row.quota_key)} override`}
                                className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                              />
                              <button
                                type="button"
                                disabled={setOverride.isPending}
                                onClick={() => handleSetOverride(row.quota_key)}
                                className="text-[var(--color-accent)] hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              {row.override_limit != null && (
                                <button
                                  type="button"
                                  disabled={removeOverride.isPending}
                                  onClick={() => handleRemoveOverride(row.quota_key)}
                                  className="text-[var(--color-danger)] hover:underline disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Plan-level policy & population</h2>
        {planPopulationLoading ? (
          <Spinner size="sm" />
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(planPopulationByPlan.entries()).map(([planCode, { planName, rows }]) => (
              <div key={planCode}>
                <p className="text-xs font-semibold text-[var(--color-ink)]">
                  {planName} <span className="font-normal text-[var(--color-ink-muted)]">— {rows[0]?.user_count ?? 0} users</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {rows.map((row) => (
                    <span
                      key={row.quota_key}
                      className="rounded-control bg-[var(--surface-inset)] px-2 py-1 text-[10px] text-[var(--color-ink-muted)]"
                    >
                      {quotaLabel(row.quota_key)}: {row.quota_limit}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}
