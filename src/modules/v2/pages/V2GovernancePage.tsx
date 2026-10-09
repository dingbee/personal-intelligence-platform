import { useEffect, useState } from 'react'
import { useV2Space } from '../workspace/SpaceContext'
import {
  createGovernancePolicy,
  listGovernancePolicies,
  setGovernancePolicyStatus,
  updateGovernancePolicy,
  type GovernanceApprovalMode,
  type GovernanceAutonomy,
} from '../governance/api/governance'

const autonomy: GovernanceAutonomy[] = ['inform', 'recommend', 'prepare', 'bounded']
const approvals: GovernanceApprovalMode[] = ['never', 'consequential', 'always']

export function V2GovernancePage() {
  const { activeSpace } = useV2Space()
  const [policies, setPolicies] = useState<Awaited<ReturnType<typeof listGovernancePolicies>>>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const businessSpaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null

  async function refresh() {
    setPolicies(await listGovernancePolicies(businessSpaceId))
  }

  useEffect(() => {
    let cancelled = false
    void listGovernancePolicies(businessSpaceId)
      .then((nextPolicies) => {
        if (!cancelled) {
          setPolicies(nextPolicies)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load governance policies.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [businessSpaceId])

  async function create() {
    if (!name.trim() || !businessSpaceId) return
    setBusy(true)
    setError(null)
    try {
      await createGovernancePolicy({
        workspaceId: businessSpaceId,
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63),
      })
      setName('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the governance policy.')
    } finally {
      setBusy(false)
    }
  }

  async function update(id: string, ceiling: GovernanceAutonomy, approvalMode: GovernanceApprovalMode) {
    setBusy(true)
    setError(null)
    try {
      await updateGovernancePolicy(id, ceiling, approvalMode, [])
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the governance policy.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(id: string, status: 'active' | 'paused') {
    setBusy(true)
    setError(null)
    try {
      await setGovernancePolicyStatus(id, status)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Only the Business Space owner can change policy status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">V2-09</p>
        <h1 className="mt-1 text-2xl font-semibold">Enterprise Governance</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
          Define Space-level governance for autonomy, consequential actions and tool scope. NoVA Core remains execution authority.
        </p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm">{error}</div>}
      {!businessSpaceId ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-sm">
          Governance policies are configured in a Business Space. Switch Space to continue.
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Policy name"
              aria-label="Policy name"
            />
            <button
              className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-50"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              Create
            </button>
          </div>
          <div className="grid gap-4">
            {policies.map((policy) => (
              <article key={policy.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{policy.name}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{policy.status} · {policy.slug}</p>
                  </div>
                  <select
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
                    value={policy.autonomyCeiling}
                    disabled={busy}
                    aria-label={`Autonomy ceiling for ${policy.name}`}
                    onChange={(event) => void update(policy.id, event.target.value as GovernanceAutonomy, policy.approvalMode)}
                  >
                    {autonomy.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Approval
                    <select
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1"
                      value={policy.approvalMode}
                      disabled={busy}
                      aria-label={`Approval mode for ${policy.name}`}
                      onChange={(event) => void update(policy.id, policy.autonomyCeiling, event.target.value as GovernanceApprovalMode)}
                    >
                      {approvals.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <button
                    className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => void toggleStatus(policy.id, policy.status === 'active' ? 'paused' : 'active')}
                  >
                    {policy.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
            {!policies.length && !error && <p className="text-sm text-[var(--text-secondary)]">No governance policies yet.</p>}
          </div>
        </>
      )}
    </section>
  )
}
