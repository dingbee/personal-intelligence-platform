import { Link } from 'react-router-dom'

const foundationAreas = [
  {
    title: 'Command Centre',
    description: 'Operational control surface for runs, approvals, intelligence and actions.',
    status: 'Next',
  },
  {
    title: 'Intelligence',
    description: 'Signals, insights, recommendations, predictions, actions and outcomes.',
    status: 'Architecture ready',
  },
  {
    title: 'Agents',
    description: 'Versioned agent definitions, capabilities, tools, memory and policies.',
    status: 'Next phase',
  },
  {
    title: 'Workflows',
    description: 'Governed orchestration from trigger through verification and outcome.',
    status: 'Next phase',
  },
  {
    title: 'Knowledge + Memory',
    description: 'Persistent context with provenance, scope and lifecycle.',
    status: 'Existing foundation',
  },
  {
    title: 'NoVA Core',
    description: 'Execution plane behind a stable runtime contract.',
    status: 'Contract phase',
  },
]

export function V2FoundationPage() {
  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                ARRIYIA V2 · FOUNDATION
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Intelligence Control Plane
              </h1>
              <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">
                V2 extends the existing ARRIYIA intelligence foundation into an enterprise control plane.
                This Preview is isolated from V1 production.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
            >
              Return to V1
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {foundationAreas.map((area) => (
            <article
              key={area.title}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold text-[var(--text-primary)]">{area.title}</h2>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                  {area.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{area.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Current milestone
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                V2-01 · Foundation
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Architecture, boundaries, domain model, inventory and technical-debt baseline are established.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] px-5 py-4 text-sm">
              <div className="font-medium text-[var(--text-primary)]">Preview only</div>
              <div className="mt-1 text-[var(--text-secondary)]">Production remains on V1 / main</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
