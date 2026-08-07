import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminChangeUserPlan,
  useAdminPlansAndQuotas,
  useAdminResetUserQuota,
  useAdminSetUserDisabled,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

/**
 * All mutations here go through SECURITY DEFINER RPCs
 * (admin_change_user_plan / admin_reset_user_quota / admin_set_user_disabled,
 * 0036_founder_command_center.sql) that re-check is_platform_admin()
 * server-side — there is no direct table write from this page. Disabling
 * an account sets auth.users.banned_until (real auth-level enforcement,
 * checked by Supabase Auth on sign-in/refresh), not a cosmetic flag; the
 * RPC itself refuses to let a founder disable their own account.
 */
export function AdminUsersPage() {
  const { data: users = [], isLoading } = useAdminUsers()
  const { data: plansAndQuotas } = useAdminPlansAndQuotas()
  const changePlan = useAdminChangeUserPlan()
  const resetQuota = useAdminResetUserQuota()
  const setDisabled = useAdminSetUserDisabled()

  const [planTargetId, setPlanTargetId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [confirmingDisable, setConfirmingDisable] = useState<{ id: string; email: string; disable: boolean } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  function openPlanPicker(userId: string) {
    setPlanTargetId(userId)
    setSelectedPlanId('')
  }

  async function submitPlanChange() {
    if (!planTargetId || !selectedPlanId) return
    await changePlan.mutateAsync({ userId: planTargetId, planId: selectedPlanId })
    setFeedback('Plan updated.')
    setPlanTargetId(null)
  }

  async function handleResetQuota(userId: string) {
    await resetQuota.mutateAsync({ userId, quotaKey: 'ai_messages' })
    setFeedback('Quota usage reset for this period.')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">View accounts, change plans, reset quota usage, disable access.</p>
      </div>

      {feedback && <p className="text-xs text-[var(--color-ink-muted)]">{feedback}</p>}

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
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--color-border)] align-top">
                    <td className="py-2 pr-4 text-[var(--color-ink)]">{u.display_name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{u.email}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                      {u.plan_name ?? '–'}
                      <div className="text-[10px]">
                        {u.quota_used ?? 0} / {u.quota_limit ?? '–'} used
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
                          disabled={resetQuota.isPending}
                          onClick={() => handleResetQuota(u.id)}
                          className="text-left text-[var(--color-accent)] hover:underline disabled:opacity-50"
                        >
                          Reset quota
                        </button>
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
                ))}
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
            setDisabled.mutate({ userId: confirmingDisable.id, disabled: confirmingDisable.disable })
            setFeedback(confirmingDisable.disable ? 'Account disabled.' : 'Account re-enabled.')
          }
          setConfirmingDisable(null)
        }}
        onCancel={() => setConfirmingDisable(null)}
      />
    </div>
  )
}
