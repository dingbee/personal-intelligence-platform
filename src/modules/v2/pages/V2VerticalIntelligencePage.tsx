import { Link } from 'react-router-dom'
import { listVerticalIntelligence } from '@/modules/v2/vertical-intelligence/registry'

export function V2VerticalIntelligencePage() {
  const verticals = listVerticalIntelligence()

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>V2-12 · VERTICAL INTELLIGENCE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Vertical Intelligence</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                Domain intelligence packs that extend ARRIYIA without coupling vertical products to the control plane or bypassing NoVA Core execution.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">Command Centre</Link>
              <Link to="/v2/agents" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">Agents</Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">Intelligence</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {verticals.map((vertical) => (
            <article key={vertical.id} className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Vertical</div><h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{vertical.name}</h2></div>
                <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">Registered</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{vertical.description}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] p-3"><div className="text-xs text-[var(--text-secondary)]">Entities</div><div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{vertical.entities.length}</div></div>
                <div className="rounded-2xl border border-[var(--border-subtle)] p-3"><div className="text-xs text-[var(--text-secondary)]">Signals</div><div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{vertical.signals.length}</div></div>
                <div className="rounded-2xl border border-[var(--border-subtle)] p-3"><div className="text-xs text-[var(--text-secondary)]">Agents</div><div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{vertical.agents.length}</div></div>
              </div>
              <div className="mt-5 space-y-2">
                {vertical.agents.map((agent) => (
                  <div key={agent.id} className="rounded-2xl border border-[var(--border-subtle)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-[var(--text-primary)]">{agent.name}</span><span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">Max: {agent.autonomy}</span></div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{agent.description}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Boundary</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Catalogue → Governance → NoVA Core</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">The autonomy shown here is a ceiling, not an execution grant. Any consequential action remains subject to workspace governance, approval policy and the V2-08 NoVA execution contract.</p>
        </section>
      </div>
    </div>
  )
}
