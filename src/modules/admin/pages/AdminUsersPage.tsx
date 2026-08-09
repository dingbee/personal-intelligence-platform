import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminChangeUserPlan,
  useAdminPlansAndQuotas,
  useAdminRemoveUserQuotaOverride,
  useAdminResetUserQuota,
  useAdminSetUserDisabled,
  useAdminSetUserQuotaOverride,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * ARRIYIA Quota Administration Remediation. All mutations here go through
 * SECURITY DEFINER RPCs (admin_change_user_plan / admin_reset_user_quota /
 * admin_set_user_quota_override / admin_remove_user_quota_override /
 * admin_set_user_disabled — 0036_founder_command_center.sql,
 * 0041_user_quota_overrides.sql) that re-check is_platform_admin()
 * server-side — there is no direct table write from this page.
 *
 * Quota model this page makes explicit (the incident this remediates: a
 * plan-wide quota edit was mistaken for a single-user control): a user's
 * effective quota is their personal override if one is set, otherwise the
 * plan default — never both, never neither. "Reset Usage" only zeroes
 * this user's current-period consumption; it never touches the quota
 * limit, plan-wide or otherwise. Every mutation below preserves the
 * current UI state and surfaces a real error message on failure — no
 * mutation here silently reverts to an apparently-unchanged screen.
 *
 * Disabling an account sets auth.users.banned_until (real auth-level
 * enforcement, checked by Supabase Auth on sign-in/refresh), not a
 * cosmetic flag; the RPC itself refuses to let a founder disable their
 * own account.
 */
export function AdminUsersPage() {
  const { data: users = [], isLoading } = useAdminUsers()
  const { data: plansAndQuotas } = useAdminPlansAndQuotas()
  const changePlan = useAdminChangeUserPlan()
  const resetUsage = useAdminResetUserQuota()
  const setOverride = useAdminSetUserQuotaOverride()
  const removeOverride = useAdminRemoveUserQuotaOverride()
  const setDisabled = useAdminSetUserDisabled()

  const [planTargetId, setPlanTargetId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [quotaTargetId, setQuotaTargetId] = useState<string | null>(null)
  const [overrideDraft, setOverrideDraft] = useState('')
  const [confirmingDisable, setConfirmingDisable] = useState<{ id: string; email: string; disable: boolean } | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function openPlanPicker(userId: string) {
    setPlanTargetId(userId)
    setSelectedPlanId('')
    setStatus(null)
  }

  async function submitPlanChange() {
    if (!planTargetId || !selectedPlanId) return
    setStatus(null)
    try {
      await changePlan.mutateAsync({ userId: planTargetId, planId: selectedPlanId })
      setStatus({ type: 'success', message: 'Plan updated.' })
      setPlanTargetId(null)
    } catch (err) {
      // Deliberately does not close the picker or clear the selection —
      // a failed change leaves the in-progress edit visible, not an
      // apparently-unchanged screen with no explanation.
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to change plan. Please try again.') })
    }
  }

  async function handleResetUsage(userId: string) {
    setStatus(null)
    try {
      await resetUsage.mutateAsync({ userId, quotaKey: 'ai_messages' })
      setStatus({ type: 'success', message: "This user's current-period usage was reset. Their quota limit is unchanged." })
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to reset usage. Please try again.') })
    }
  }

  function openQuotaPanel(userId: string, currentOverride: number | null) {
    setQuotaTargetId(userId)
    setOverrideDraft(currentOverride != null ? String(currentOverride) : '')
    setStatus(null)
  }

  async function handleSetOverride(userId: string) {
    const parsed = Number(overrideDraft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStatus({ type: 'error', message: 'Enter a non-negative number.' })
      return
    }
    setStatus(null)
    try {
      await setOverride.mutateAsync({ userId, quotaKey: 'ai_messages', quotaLimit: parsed })
      setStatus({ type: 'success', message: 'Personal quota override saved — this affects only this user.' })
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to save the override. Please try again.') })
    }
  }

  async function handleRemoveOverride(userId: string) {
    setStatus(null)
    try {
      await removeOverride.mutateAsync({ userId, quotaKey: 'ai_messages' })
      setStatus({ type: 'success', message: "Override removed — this user is back to the plan's default quota." })
      setOverrideDraft('')
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to remove the override. Please try again.') })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          View accounts, change plans, manage per-user quota overrides, reset usage, disable access.
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

      <SurfaceCard>
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Last activity</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const used = u.quota_used ?? 0
                  const effective = u.effective_quota_limit
                  const remaining = effective != null ? Math.max(0, effective - used) : null
                  return (
                    <tr key={u.id} className="border-t border-[var(--color-border)] align-top">
                      <td className="py-2 pr-4 text-[var(--color-ink)]">{u.display_name ?? '—'}</td>
                      <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{u.email}</td>
                      <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                        {u.plan_name ?? '–'}
                        <div className="text-[10px]">
                          {used} / {effective ?? '–'} used{u.quota_override != null ? ' · override' : ''}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {u.is_disabled ? (
                          <span className="text-[var(--color-danger)]">Disabled</span>
                        ) : (
                          <span className="text-[var(--color-success-strong)]">Active</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          {planTargetId === u.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                              >
                                <option value="">Choose plan…</option>
                                {plansAndQuotas?.plans.map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!selectedPlanId || changePlan.isPending}
                                onClick={submitPlanChange}
                                className="text-[var(--color-accent)] hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button type="button" onClick={() => setPlanTargetId(null)} className="text-[var(--color-ink-muted)] hover:underline">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openPlanPicker(u.id)} className="text-left text-[var(--color-accent)] hover:underline">
                              Change plan
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openQuotaPanel(u.id, u.quota_override)}
                            className="text-left text-[var(--color-accent)] hover:underline"
                          >
                            Manage quota
                          </button>

                          <button
                            type="button"
                            disabled={resetUsage.isPending}
                            onClick={() => handleResetUsage(u.id)}
                            title="Resets this user's current-period usage. This does not change their quota limit."
                            className="text-left text-[var(--color-accent)] hover:underline disabled:opacity-50"
                          >
                            Reset Usage
                          </button>
                          <p className="max-w-[14rem] text-[10px] text-[var(--color-ink-muted)]">
                            Reset Usage clears this user's usage only — it never changes their quota limit.
                          </p>

                          {quotaTargetId === u.id && (
                            <div className="mt-1 flex flex-col gap-1 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2">
                              <div className="text-[10px] text-[var(--color-ink-muted)]">
                                Plan quota: {u.plan_quota_limit ?? '–'}
                                <br />
                                Personal override: {u.quota_override ?? 'None'}
                                <br />
                                Effective quota: {effective ?? '–'}
                                <br />
                                Current usage: {used}
                                <br />
                                Remaining: {remaining ?? '–'}
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={overrideDraft}
                                  onChange={(e) => setOverrideDraft(e.target.value)}
                                  placeholder="Override limit"
                                  aria-label="Quota override"
                                  className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                                />
                                <button
                                  type="button"
                                  disabled={setOverride.isPending}
                                  onClick={() => handleSetOverride(u.id)}
                                  className="text-[var(--color-accent)] hover:underline disabled:opacity-50"
                                >
                                  Save
                                </button>
                                {u.quota_override != null && (
                                  <button
                                    type="button"
                                    disabled={removeOverride.isPending}
                                    onClick={() => handleRemoveOverride(u.id)}
                                    className="text-[var(--color-danger)] hover:underline disabled:opacity-50"
                                  >
                                    Remove override
                                  </button>
                                )}
                                <button type="button" onClick={() => setQuotaTargetId(null)} className="text-[var(--color-ink-muted)] hover:underline">
                                  Close
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setConfirmingDisable({ id: u.id, email: u.email, disable: !u.is_disabled })}
                            className="text-left text-[var(--color-danger)] hover:underline"
                          >
                            {u.is_disabled ? 'Re-enable account' : 'Disable account'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <ConfirmDialog
        open={confirmingDisable !== null}
        title={confirmingDisable?.disable ? 'Disable this account?' : 'Re-enable this account?'}
        description={
          confirmingDisable?.disable
            ? `${confirmingDisable.email} will be immediately signed out and unable to sign back in until re-enabled.`
            : `${confirmingDisable?.email} will be able to sign in again.`
        }
        confirmLabel={confirmingDisable?.disable ? 'Disable' : 'Re-enable'}
        destructive={confirmingDisable?.disable}
        onConfirm={() => {
          if (confirmingDisable) {
            const target = confirmingDisable
            setStatus(null)
            setDisabled.mutate(
              { userId: target.id, disabled: target.disable },
              {
                onSuccess: () => setStatus({ type: 'success', message: target.disable ? 'Account disabled.' : 'Account re-enabled.' }),
                onError: (err) => setStatus({ type: 'error', message: errorMessage(err, 'Failed to update this account. Please try again.') }),
              },
            )
          }
          setConfirmingDisable(null)
        }}
        onCancel={() => setConfirmingDisable(null)}
      />
    </div>
  )
}
