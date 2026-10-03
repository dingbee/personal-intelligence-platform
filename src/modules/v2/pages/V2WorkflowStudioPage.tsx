import { Link } from 'react-router-dom'

const nodes = [
  ['Understand', 'Context and memory preparation.'],
  ['Agent', 'Reference a governed V2 agent.'],
  ['Tool', 'Reference a governed tool capability.'],
  ['Condition', 'Declarative branch condition.'],
  ['Approval', 'Human or policy approval gate.'],
  ['Action', 'Consequential action declaration.'],
  ['Verify', 'Post-action verification step.'],
]

const boundaries = [
  ['Workflow model', 'Declarative workflow identity, trigger, nodes and version.'],
  ['Graph integrity', 'Every edge must resolve to a declared node.'],
  ['Dependencies', 'Agents, tools and approvals remain explicitly referenced and scoped.'],
  ['Versioning', 'Definition changes require an increasing version and return the workflow to draft.'],
  ['Activation', 'Activation revalidates dependencies; inactive agents/tools cannot enter an active workflow.'],
  ['Execution', 'No workflow execution occurs here. V2-08 crosses the contract into NoVA Core.'],
]

export function V2WorkflowStudioPage() {
  return <div className="min-h-full bg-[var(--surface-base)]"><div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]"><span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span><span>WORKFLOW CONTROL PLANE</span></div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Workflow Studio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">Compose governed agents, tools, conditions, approvals and actions into declarative workflows. The Studio defines execution; NoVA Core executes it through the V2-08 runtime contract.</p></div>
        <nav className="flex flex-wrap gap-2">
          <Link to="/v2">Command Centre</Link><Link to="/v2/agents">Agents</Link><Link to="/v2/intelligence">Intelligence</Link><Link to="/v2/knowledge-memory">Knowledge + Memory</Link>
        </nav>
      </div>
    </header>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{nodes.map(([name, detail], i)=><article key={name} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><div className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">0{i+1}</div><h2 className="mt-3 font-semibold text-[var(--text-primary)]">{name}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p></article>)}</section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{boundaries.map(([title, detail])=><article key={title} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><h2 className="font-semibold text-[var(--text-primary)]">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail}</p></article>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Declarative graph</div><pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-xs leading-6 text-[var(--text-primary)]">{`{
  trigger: { type: "manual" },
  nodes: [
    { type: "understand", next: ["research"] },
    { type: "agent", config: { agentId: "…" }, next: ["check"] },
    { type: "condition", config: { expression: "…" } }
  ]
}`}</pre></article>
      <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Runtime boundary</div><h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Studio → Contract → NoVA</h2><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Workflow Studio owns definition and governance references. It does not schedule, execute nodes, invoke tools, run agents or manage workers.</p></article>
    </section>
  </div></div>
}
