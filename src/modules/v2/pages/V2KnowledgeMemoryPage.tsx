import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useV2Space } from '../workspace/SpaceContext'
import { useAuth } from '@/modules/auth/useAuth'
import { getV2KnowledgeMemorySummary, retrieveV2Context } from '../knowledge-memory/contextAdapter'

const lifecycle = [
  ['01', 'Discover', 'Retrieve authorized knowledge from existing sources.'],
  ['02', 'Ground', 'Attach evidence and provenance to retrieved context.'],
  ['03', 'Remember', 'Select relevant memory within explicit scope and lifecycle rules.'],
  ['04', 'Contextualize', 'Combine knowledge + memory for intelligence and future agents.'],
]

export function V2KnowledgeMemoryPage() {
  const { activeSpace } = useV2Space()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const workspaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null
  const scopeLabel = activeSpace?.kind === 'business' ? activeSpace.name : 'Personal Space'

  const summaryQuery = useQuery({
    queryKey: ['v2-knowledge-memory-summary', workspaceId],
    queryFn: () => getV2KnowledgeMemorySummary(workspaceId),
    enabled: Boolean(activeSpace && user),
    staleTime: 20_000,
  })

  const contextQuery = useQuery({
    queryKey: ['v2-context-probe', workspaceId, submittedQuery],
    queryFn: () => retrieveV2Context({ userId: user!.id, workspaceId, query: submittedQuery }),
    enabled: Boolean(user && activeSpace && submittedQuery),
    staleTime: 20_000,
  })

  const summary = summaryQuery.data
  const context = contextQuery.data
  const memoryTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const memory of summary?.memories ?? []) counts.set(memory.memory_type, (counts.get(memory.memory_type) ?? 0) + 1)
    return [...counts.entries()]
  }, [summary?.memories])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = query.trim()
    if (next) setSubmittedQuery(next)
  }

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>CONTEXT PLANE</span><span>·</span><span>{scopeLabel}</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Knowledge + Memory</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                One governed context boundary for knowledge retrieval and personal memory.
                V2 composes the existing ARRIYIA substrate; it does not create another store or retrieval engine.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Command Centre</Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Intelligence</Link>
              <Link to="/v2/agents" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Agents</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Knowledge nodes', summary?.knowledgeNodes.length ?? 0, 'Authorized knowledge graph concepts in this Space.'],
            ['Collections', summary?.collections.length ?? 0, 'Curated knowledge collections visible in this Space.'],
            ['Active memories', summary?.memories.length ?? 0, 'Owner-scoped memory available to this context.'],
            ['Context evidence', context?.evidence.length ?? 0, 'Evidence returned by the governed context probe.'],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Context probe</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Test the same governed retrieval boundary future intelligence, agents and workflows will consume.
              Results are read-only and remain scoped to the active Space.
            </p>
          </div>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask what this Space knows about…"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)]"
            />
            <button type="submit" disabled={!query.trim() || contextQuery.isFetching} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] disabled:opacity-50">
              Retrieve context
            </button>
          </form>
          {contextQuery.isFetching && <p className="mt-4 text-sm text-[var(--text-secondary)]">Retrieving authorized context…</p>}
          {contextQuery.isError && <p className="mt-4 text-sm text-[var(--text-secondary)]">Context retrieval is unavailable. No fallback or unscoped data is shown.</p>}
          {context && !contextQuery.isFetching && (
            <div className="mt-5">
              <div className="grid gap-3 sm:grid-cols-4">
                {Object.entries(context.counts).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--border-subtle)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</div>
                    <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 divide-y divide-[var(--border-subtle)]">
                {context.evidence.length === 0 ? <p className="py-4 text-sm text-[var(--text-secondary)]">No relevant context was found.</p> :
                  context.evidence.map((item) => (
                    <article key={item.type + item.id} className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{item.type}</span>
                        {item.score !== null && <span className="text-[11px] text-[var(--text-secondary)]">{item.score.toFixed(2)}</span>}
                      </div>
                      <h3 className="mt-1 text-sm font-medium text-[var(--text-primary)]">{item.title}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{item.excerpt}</p>
                    </article>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Context lifecycle</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Knowledge and memory have a defined path into the intelligence loop.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {lifecycle.map(([number, title, detail]) => (
              <article key={number} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">{number}</div>
                <h3 className="mt-3 font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Memory boundary</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Personal memory remains owner-scoped by design. A Business Space does not turn one member's private memory into shared enterprise knowledge.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {memoryTypes.map(([type, count]) => <span key={type} className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]">{type.replaceAll('_', ' ')} · {count}</span>)}
            </div>
          </article>
          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">What V2 does not own</h2>
            <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
              <p>• A second document or vector store.</p>
              <p>• A replacement memory database.</p>
              <p>• A parallel provenance ledger.</p>
              <p>• Runtime execution or tool invocation.</p>
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
