import { Link } from 'react-router-dom'

type Stage = {
  number: string
  name: string
  resource: string
  description: string
  state: 'Foundation ready' | 'Centre live' | 'Runtime pending'
}

const stages: Stage[] = [
  {
    number: '01',
    name: 'Observe',
    resource: 'Events · Signals',
    description: 'Capture what happened and turn governed events into scoped signals.',
    state: 'Foundation ready',
  },
  {
    number: '02',
    name: 'Understand',
    resource: 'Context · Memory',
    description: 'Enrich signals with workspace context, knowledge and memory.',
    state: 'Foundation ready',
  },
  {
    number: '03',
    name: 'Reason',
    resource: 'Insights · Predictions',
    description: 'Derive explanations and forward-looking assessments from evidence.',
    state: 'Centre live',
  },
  {
    number: '04',
    name: 'Recommend',
    resource: 'Recommendations',
    description: 'Translate intelligence into governed, traceable recommendations.',
    state: 'Centre live',
  },
  {
    number: '05',
    name: 'Act',
    resource: 'Actions · Approvals · Runs',
    description: 'Prepare consequential actions for policy and runtime-controlled execution.',
    state: 'Runtime pending',
  },
  {
    number: '06',
    name: 'Learn',
    resource: 'Outcomes · Feedback',
    description: 'Measure what happened and feed outcomes back into the intelligence loop.',
    state: 'Runtime pending',
  },
]

const records = [
  { type: 'Signal', title: 'No runtime-fed signals yet', detail: 'The signal contract is defined; live ingestion arrives through the runtime/event plane.' },
  { type: 'Insight', title: 'No derived insights yet', detail: 'Insights will retain their source signal and provenance chain.' },
  { type: 'Recommendation', title: 'No governed recommendations yet', detail: 'Recommendations will connect intelligence to an intended action.' },
  { type: 'Prediction', title: 'No predictions yet', detail: 'Predictions are scoped to a subject, horizon and probability when supplied.' },
]

export function V2IntelligenceCentrePage() {
  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>INTELLIGENCE PLANE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Intelligence Centre
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                The intelligence layer between observation and execution. V2-04 connects the
                canonical signal → insight → recommendation → prediction → action → outcome model
                to the Command Centre established in V2-03.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Command Centre
              </Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Intelligence
              </Link>
              <Link to="/v2/foundation" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                Foundation
              </Link>
            </nav>
          </div>
        </header>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Intelligence loop</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                The same loop exposed by the Command Centre, now expanded into its canonical resources.
              </p>
            </div>
            <Link to="/v2" className="text-xs font-medium text-[var(--text-primary)] underline-offset-4 hover:underline">
              Back to operational state →
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stages.map((stage) => (
              <article key={stage.number} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">{stage.number}</span>
                  <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                    {stage.state}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">{stage.name}</h3>
                <div className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{stage.resource}</div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{stage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Signals', '0', 'Observation resources awaiting runtime-fed events.'],
            ['Insights', '0', 'Reasoned intelligence linked back to evidence.'],
            ['Recommendations', '0', 'Governed decisions prepared for action.'],
            ['Predictions', '0', 'Forward-looking assessments with explicit assumptions.'],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
              <div className="text-xs text-[var(--text-secondary)]">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Intelligence records</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Empty-state records are intentional: V2 has the contracts and control surface, but live runtime ingestion is not connected until V2-08.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {records.map((record) => (
              <article key={record.type} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{record.type}</div>
                <h3 className="mt-2 font-medium text-[var(--text-primary)]">{record.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{record.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Traceability</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Evidence stays attached</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Signals, insights and recommendations can retain provenance instead of becoming opaque AI output.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Control</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Intelligence does not execute itself</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Recommendations flow toward governed actions; runtime execution remains behind the V2-08 contract.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Continuity</div>
            <h2 className="mt-2 font-semibold text-[var(--text-primary)]">Feeds the Command Centre</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Operational state remains the top-level view; this centre provides the intelligence behind it.
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}
