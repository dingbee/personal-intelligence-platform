import { Link } from 'react-router-dom'

type Status = 'Healthy' | 'Active' | 'Waiting' | 'Attention'

const systemState = [
  { label: 'Control plane', value: 'Operational', status: 'Healthy' as Status },
  { label: 'Workspace access', value: 'Scoped', status: 'Healthy' as Status },
  { label: 'Intelligence loop', value: 'Ready', status: 'Active' as Status },
  { label: 'Runtime', value: 'Contract pending', status: 'Waiting' as Status },
]

const runs = [
  { name: 'Workspace intelligence sync', source: 'Intelligence', status: 'Active' as Status, time: 'Just now' },
  { name: 'Knowledge context preparation', source: 'Knowledge', status: 'Waiting' as Status, time: '4 min ago' },
  { name: 'Recommendation evaluation', source: 'Intelligence', status: 'Healthy' as Status, time: '12 min ago' },
]

const approvals = [
  { title: 'Runtime action approval', detail: 'Execution contract is not connected yet.', status: 'Waiting' as Status },
  { title: 'Workspace policy review', detail: 'Governance policy layer is scheduled for V2-09.', status: 'Waiting' as Status },
]

const intelligence = [
  { label: 'Signals', value: '0', detail: 'Runtime-fed signals will appear here.' },
  { label: 'Insights', value: '0', detail: 'Derived intelligence will appear here.' },
  { label: 'Recommendations', value: '0', detail: 'Governed recommendations will appear here.' },
  { label: 'Predictions', value: '0', detail: 'Prediction resources are defined in the V2 contract.' },
]

const statusClass: Record<Status, string> = {
  Healthy: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  Active: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  Waiting: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  Attention: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
}

export function V2CommandCentrePage() {
  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>CONTROL PLANE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Command Centre
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                One operational surface for system state, runs, approvals and intelligence.
                V2 is establishing the control plane before runtime execution is connected.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Command Centre
              </Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Intelligence
              </Link>
              <Link to="/v2/foundation" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Foundation
              </Link>
              <Link to="/v2/agents" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Agents
              </Link>
              <Link to="/dashboard" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                V1
              </Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {systemState.map((item) => (
            <article key={item.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-base font-semibold text-[var(--text-primary)]">{item.value}</span>
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">{item.status}</span>
              </div>
            </article>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Runs</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Execution state represented through the V2 run contract.</p>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Preview telemetry</span>
            </div>
            <div className="mt-5 divide-y divide-[var(--border-subtle)]">
              {runs.map((run) => (
                <div key={run.name} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{run.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{run.source} · {run.time}</div>
                  </div>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] ${statusClass[run.status]}`}>
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Approvals</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Consequential execution remains governed.</p>
            <div className="mt-5 space-y-3">
              {approvals.map((approval) => (
                <article key={approval.title} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">{approval.title}</h3>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">{approval.status}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{approval.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Intelligence</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Observe → Understand → Reason → Recommend → Act → Learn.</p>
            </div>
            <Link to="/v2/intelligence" className="text-xs font-medium text-[var(--text-primary)] underline-offset-4 hover:underline">Open Intelligence Centre →</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {intelligence.map((item) => (
              <article key={item.label} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="text-xs text-[var(--text-secondary)]">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{item.value}</div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Actions</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Governed action plane</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Actions are defined, scoped and approval-aware. Runtime execution arrives in V2-08.</p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Alerts</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Operational attention</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">The control surface is ready for runtime events and policy-driven alerts.</p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Scope</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Workspace isolated</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">V2 resource access remains explicitly organization and workspace scoped.</p>
          </article>
        </section>
      </div>
    </div>
  )
}
