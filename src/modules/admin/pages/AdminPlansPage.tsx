import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminPlansAndQuotas,
  useAdminSetPlanAiProvider,
  useAdminUpdatePlanCommercial,
  useAdminUpdatePlanQuota,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import { providerRegistry } from '@/modules/core/providers/registry'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function formatPrice(cents: number | null, currency: string): string {
  if (cents === null) return 'Not set'
  return `${(cents / 100).toFixed(2)} ${currency}`
}

/**
 * ARRIYIA Quota Administration Remediation, extended by Phase 5A into the
 * central "Plans & Commercial" control surface — plan catalog, pricing
 * metadata, quotas, and the AI-provider allocation matrix all in one
 * place, per the directive that this become the one admin surface for
 * commercial configuration. No payment processing lives here — pricing
 * fields are configuration/data only (admin_update_plan_commercial never
 * touches entitlement/quota logic), and AI providers are never shown as
 * anything but this admin page's own concern: ordinary users never see a
 * provider id, label, or model name anywhere (see ExplainAnswerPanel/
 * AdvancedSettingsPage's own Phase 5A comments).
 *
 * Quota limits are edited through admin_update_plan_quota (SECURITY
 * DEFINER, is_platform_admin()-checked) — plan_quotas has no client write
 * policy at all (0034_beta_invite_quota_repair.sql), so there is no
 * direct-table-write path here even for a founder. Same structural
 * guarantee for admin_set_plan_ai_provider / admin_update_plan_commercial.
 *
 * This is a PLAN-WIDE control, not a per-user one — the incident this
 * remediates was exactly that ambiguity: editing a plan's quota here
 * changes the number for every user on that plan simultaneously, which
 * is easy to mistake for a single-user action if the scope isn't stated
 * plainly. Every quota edit shows the plan-wide warning and the live count
 * of affected users, and requires an explicit confirmation before saving.
 * To give one specific user a different limit without affecting anyone
 * else, use the Users page's personal quota override instead.
 */
export function AdminPlansPage() {
  const { data, isLoading } = useAdminPlansAndQuotas()
  const { data: users = [] } = useAdminUsers()
  const updateQuota = useAdminUpdatePlanQuota()
  const setPlanProvider = useAdminSetPlanAiProvider()
  const updateCommercial = useAdminUpdatePlanCommercial()

  const chatProviders = useMemo(() => providerRegistry.list().filter((p) => p.kind === 'chat' && p.status === 'available'), [])

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

  const [editingCommercialPlanId, setEditingCommercialPlanId] = useState<string | null>(null)
  const [draftCommercial, setDraftCommercial] = useState<{ monthly: string; annual: string; currency: string; active: boolean }>({
    monthly: '',
    annual: '',
    currency: 'USD',
    active: true,
  })

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

  function startEditCommercial(planId: string, monthly: number | null, annual: number | null, currency: string, active: boolean) {
    setEditingCommercialPlanId(planId)
    setDraftCommercial({
      monthly: monthly === null ? '' : String(monthly / 100),
      annual: annual === null ? '' : String(annual / 100),
      currency,
      active,
    })
    setStatus(null)
  }

  async function saveCommercial(planId: string) {
    const monthlyCents = draftCommercial.monthly.trim() === '' ? null : Math.round(Number(draftCommercial.monthly) * 100)
    const annualCents = draftCommercial.annual.trim() === '' ? null : Math.round(Number(draftCommercial.annual) * 100)
    if ((monthlyCents !== null && !Number.isFinite(monthlyCents)) || (annualCents !== null && !Number.isFinite(annualCents))) {
      setStatus({ type: 'error', message: 'Enter valid prices, or leave a field blank for "not set".' })
      return
    }
    try {
      await updateCommercial.mutateAsync({
        planId,
        monthlyPriceCents: monthlyCents,
        annualPriceCents: annualCents,
        currency: draftCommercial.currency.trim() || 'USD',
        active: draftCommercial.active,
      })
      setStatus({ type: 'success', message: 'Commercial details updated.' })
      setEditingCommercialPlanId(null)
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Failed to update commercial details. Please try again.') })
    }
  }

  function toggleProvider(planId: string, providerId: string, currentActive: boolean, currentPriority: number) {
    setPlanProvider.mutate(
      { planId, providerId, active: !currentActive, priority: currentPriority },
      { onError: (err) => setStatus({ type: 'error', message: errorMessage(err, 'Failed to update provider allocation.') }) },
    )
  }

  function setProviderPriority(planId: string, providerId: string, currentActive: boolean, priority: string) {
    const parsed = Number(priority)
    if (!Number.isFinite(parsed)) return
    setPlanProvider.mutate({ planId, providerId, active: currentActive, priority: parsed })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Plans & Commercial</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          The plan catalog, its pricing metadata, quota limits, and AI provider allocation. Changes here are plan-wide —
          they affect every user on that plan. To give one user a different limit, or move a user onto a different
          plan, use{' '}
          <Link to="/admin/users" className="text-[var(--color-accent)] hover:underline">
            Users
          </Link>
          . No payment processing happens on this page — pricing fields are informational until a payment provider is
          wired up.
        </p>
      </div>

      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.plans.map((plan) => {
            const affectedUsers = users.filter((u) => u.plan_code === plan.code).length
            const isEditingCommercial = editingCommercialPlanId === plan.id

            return (
              <SurfaceCard key={plan.id} className="flex flex-col gap-4">
                <div>
                  <div className="text-sm font-medium text-[var(--color-ink)]">{plan.name}</div>
                  <div className="text-xs text-[var(--color-ink-muted)]">
                    {plan.code} · {affectedUsers} {affectedUsers === 1 ? 'user' : 'users'}
                  </div>
                  {plan.description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{plan.description}</p>}
                </div>

                {/* Commercial metadata */}
                <div className="rounded-control border border-[var(--color-border)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Commercial</p>
                  {isEditingCommercial ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
                        Monthly price
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Not set"
                          value={draftCommercial.monthly}
                          onChange={(e) => setDraftCommercial((prev) => ({ ...prev, monthly: e.target.value }))}
                          className="w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
                        Annual price
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Not set"
                          value={draftCommercial.annual}
                          onChange={(e) => setDraftCommercial((prev) => ({ ...prev, annual: e.target.value }))}
                          className="w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
                        Currency
                        <input
                          type="text"
                          maxLength={3}
                          value={draftCommercial.currency}
                          onChange={(e) => setDraftCommercial((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                          className="w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                        <input
                          type="checkbox"
                          checked={draftCommercial.active}
                          onChange={(e) => setDraftCommercial((prev) => ({ ...prev, active: e.target.checked }))}
                        />
                        Plan active
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updateCommercial.isPending}
                          onClick={() => void saveCommercial(plan.id)}
                          className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCommercialPlanId(null)}
                          className="text-xs text-[var(--color-ink-muted)] hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditCommercial(plan.id, plan.monthly_price_cents, plan.annual_price_cents, plan.currency, plan.active)}
                      className="mt-1 flex flex-col gap-0.5 text-left text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                    >
                      <span>Monthly: {formatPrice(plan.monthly_price_cents, plan.currency)}</span>
                      <span>Annual: {formatPrice(plan.annual_price_cents, plan.currency)}</span>
                      <span>{plan.active ? 'Active' : 'Inactive'} — edit</span>
                    </button>
                  )}
                </div>

                {/* Quotas + features (feature:* keys share this generic quota_key list) */}
                <div className="rounded-control border border-[var(--color-border)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Quotas & Features</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {data.quotas
                      .filter((q) => q.plan_id === plan.id)
                      .map((quota) => (
                        <div key={quota.id} className="rounded-control border border-[var(--color-border)] p-2">
                          <div className="text-xs font-medium text-[var(--color-ink)]">{quota.quota_key}</div>
                          {editingQuotaId === quota.id ? (
                            <div className="mt-1 flex flex-col gap-1">
                              <p className="rounded bg-[var(--surface-inset)] px-1.5 py-1 text-[10px] text-[var(--color-ink-muted)]">
                                <strong className="text-[var(--color-ink)]">Plan-wide setting.</strong> This changes the
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
                </div>

                {/* AI provider allocation — admin-only surface; providers are never named anywhere a non-admin can see. */}
                <div className="rounded-control border border-[var(--color-border)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">AI Providers</p>
                  <p className="mt-1 text-[10px] text-[var(--color-ink-muted)]">
                    Which providers ARRIYIA may route this plan's requests to, and in what priority order. Never shown
                    to users — NOVA picks automatically.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {chatProviders.map((provider) => {
                      const allocation = data.aiProviders.find((a) => a.plan_id === plan.id && a.provider_id === provider.id)
                      const active = allocation?.active ?? false
                      const priority = allocation?.priority ?? 0
                      return (
                        <div key={provider.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-[var(--color-ink)]">{provider.label}</span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-[var(--color-ink-muted)]">
                              Priority
                              <input
                                type="number"
                                value={priority}
                                onChange={(e) => setProviderPriority(plan.id, provider.id, active, e.target.value)}
                                className="w-14 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs text-[var(--color-ink)]"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={setPlanProvider.isPending}
                              onClick={() => toggleProvider(plan.id, provider.id, active, priority)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium disabled:opacity-60 ${
                                active
                                  ? 'bg-[var(--surface-inset)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                                  : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-strong)]'
                              }`}
                            >
                              {active ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
