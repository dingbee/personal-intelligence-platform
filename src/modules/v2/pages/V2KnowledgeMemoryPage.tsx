import { Link } from 'react-router-dom'

const knowledgeLayers = [
  {
    title: 'Knowledge',
    detail: 'Documents, notes, conversations, assets, knowledge nodes and datasets remain native V1 sources.',
    state: 'Existing substrate',
  },
  {
    title: 'Retrieval',
    detail: 'V2 consumes the established retrieval paths through an explicit control-plane adapter rather than creating a second search engine.',
    state: 'Adapter boundary',
  },
  {
    title: 'Provenance',
    detail: 'Source → evidence → derivation remains the evidence chain used by intelligence outputs.',
    state: 'Shared foundation',
  },
  {
    title: 'Memory',
    detail: 'Existing personal, learned and conversation memory becomes scoped V2 context through a governed memory contract.',
    state: 'Adapter boundary',
  },
]

const lifecycle = [
  ['Discover', 'Retrieve authorized knowledge from existing sources.'],
  ['Ground', 'Attach evidence and provenance to retrieved context.'],
  ['Remember', 'Select relevant memory within explicit scope and lifecycle rules.'],
  ['Contextualize', 'Combine knowledge + memory for intelligence and future agents.'],
]

export function V2KnowledgeMemoryPage() {
  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>CONTEXT PLANE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Knowledge + Memory
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                Persistent context for the intelligence and execution control plane.
                V2 connects to the mature ARRIYIA knowledge, retrieval, memory and provenance
                substrate instead of rebuilding those systems.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Command Centre
              </Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Intelligence
              </Link>
              <Link to="/v2/foundation" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Foundation
              </Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {knowledgeLayers.map((layer) => (
            <article key={layer.title} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-[var(--text-primary)]">{layer.title}</h2>
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                  {layer.state}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{layer.detail}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Context lifecycle</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Knowledge and memory now have a defined path into the intelligence loop.
              </p>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">V2 control-plane contract</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {lifecycle.map(([title, detail], index) => (
              <article key={title} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">0{index + 1}</div>
                <h3 className="mt-3 font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">What V2 now owns</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>• Explicit organization/workspace scope for context consumption.</p>
              <p>• A stable adapter contract for knowledge retrieval and memory retrieval.</p>
              <p>• Provenance as evidence attached to context, not an independent data store.</p>
              <p>• Memory lifecycle and policy vocabulary ready for governance in V2-09.</p>
              <p>• A shared context shape that future agents and workflows can consume.</p>
            </div>
          </article>

          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">What V2 deliberately does not own</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <p>• A second document store.</p>
              <p>• A second vector database.</p>
              <p>• A competing retrieval engine.</p>
              <p>• A replacement for existing memory persistence.</p>
              <p>• Runtime execution.</p>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Continuity</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            Knowledge → Memory → Intelligence → Action
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            V2-05 closes the context gap between the Intelligence Centre and the future Agent,
            Workflow and NoVA runtime layers. The next phases can consume one governed context
            boundary instead of reaching directly into unrelated V1 stores.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
              Intelligence Centre →
            </Link>
            <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              Command Centre →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
