import { Link } from 'react-router-dom'

const lifecycle = [
  ['Define', 'Purpose, capabilities, memory scopes, governed tools and policies.'],
  ['Validate', 'Resolve every tool and policy dependency inside the workspace boundary.'],
  ['Version', 'Definition changes require an explicit monotonically increasing version.'],
  ['Activate', 'Only a validated definition can become an active control-plane agent.'],
]

const boundaries = [
  ['Agent model', 'Canonical V2 resource with explicit definition, version and workspace scope.'],
  ['Catalogue', 'Reuses ARRIYIA existing registry abstraction; no competing registry engine.'],
  ['Capabilities', 'Declared capabilities remain descriptive until runtime binding.'],
  ['Tools', 'References are validated and governed; execution remains outside V2.'],
  ['Policies', 'Policy references are explicit and ready for V2-14 governance enforcement.'],
  ['Versions', 'Definition version is monotonic; changes return the agent to draft.'],
]

export function V2AgentManagementPage() {
  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>AGENT CONTROL PLANE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Agent Management</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                Define, validate, version and govern agents as control-plane resources.
                V2 describes agent capabilities and dependencies; NoVA Core remains responsible for execution.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2">Command Centre</Link>
              <Link to="/v2/intelligence">Intelligence</Link>
              <Link to="/v2/knowledge-memory">Knowledge + Memory</Link>
              <Link to="/v2/foundation">Foundation</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {lifecycle.map(([title, detail], index) => (
            <article key={title} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
              <div className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">0{index + 1}</div>
              <h2 className="mt-3 font-semibold text-[var(--text-primary)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boundaries.map(([title, detail]) => (
            <article key={title} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
              <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Agent definition</div>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-primary)]">{`{
  version: 1,
  systemPurpose: "…",
  capabilities: ["research", "analysis"],
  toolIds: ["…"],
  memoryScopes: ["workspace", "project"],
  policyIds: ["…"]
}`}</pre>
          </article>
          <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Execution boundary</div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Control → Contract → NoVA</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Agent Management owns the definition and governance references. It does not execute
              prompts, call tools, schedule work, manage workers or implement MCP runtime behavior.
              Those capabilities cross the V2-08 runtime contract into NoVA Core.
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}
