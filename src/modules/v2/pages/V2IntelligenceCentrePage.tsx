import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useV2Space } from '../workspace/SpaceContext'
import { listIntelligenceRecords } from '@/modules/intelligence-ledger/api/ledgerQueries'
import { listLearningSignals } from '@/modules/learning-intelligence/api/learningQueries'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

type Stage = {
  number: string
  name: string
  resource: string
  description: string
}

const stages: Stage[] = [
  { number: '01', name: 'Observe', resource: 'Events · Signals', description: 'Capture what happened and turn governed events into scoped signals.' },
  { number: '02', name: 'Understand', resource: 'Context · Memory', description: 'Enrich signals with workspace context, knowledge and memory.' },
  { number: '03', name: 'Reason', resource: 'Insights · Predictions', description: 'Derive explanations and forward-looking assessments from evidence.' },
  { number: '04', name: 'Recommend', resource: 'Recommendations', description: 'Translate intelligence into governed, traceable recommendations.' },
  { number: '05', name: 'Act', resource: 'Actions · Approvals · Runs', description: 'Prepare consequential actions for policy and runtime-controlled execution.' },
  { number: '06', name: 'Learn', resource: 'Outcomes · Feedback', description: 'Measure what happened and feed outcomes back into the intelligence loop.' },
]

const stageForRecord: Record<IntelligenceRecord['recordType'], string> = {
  data: 'Observe',
  research: 'Understand',
  analysis: 'Reason',
  planning: 'Reason',
  decision: 'Recommend',
  action: 'Act',
  execution: 'Act',
}

const statusClass: Record<IntelligenceRecord['status'], string> = {
  created: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  running: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  completed: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  failed: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  superseded: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
  archived: 'border-[var(--border-subtle)] bg-[var(--surface-muted)]',
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

export function V2IntelligenceCentrePage() {
  const { activeSpace } = useV2Space()
  const workspaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null
  const scopeLabel = activeSpace?.kind === 'business' ? activeSpace.name : 'Personal Space'

  const recordsQuery = useQuery({
    queryKey: ['v2-intelligence-records', workspaceId],
    queryFn: () => listIntelligenceRecords(workspaceId),
    enabled: Boolean(activeSpace),
    staleTime: 15_000,
  })

  const learningQuery = useQuery({
    queryKey: ['v2-learning-signals', workspaceId],
    queryFn: () => listLearningSignals({ workspaceId }),
    enabled: Boolean(activeSpace),
    staleTime: 15_000,
  })

  const records = recordsQuery.data ?? []
  const learningSignals = learningQuery.data ?? []

  const recordCounts = useMemo(() => ({
    observe: records.filter((record) => record.recordType === 'data').length,
    understand: records.filter((record) => record.recordType === 'research').length,
    reason: records.filter((record) => record.recordType === 'analysis' || record.recordType === 'planning').length,
    recommend: records.filter((record) => record.recordType === 'decision').length,
    act: records.filter((record) => record.recordType === 'action' || record.recordType === 'execution').length,
    learn: learningSignals.length,
  }), [records, learningSignals])

  const latestRecords = records.slice(0, 8)

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>INTELLIGENCE PLANE</span><span>·</span><span>{scopeLabel}</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Intelligence Centre</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                The intelligence layer between observation and execution. V2 presents the canonical
                signal → insight → recommendation → prediction → action → outcome model while
                reusing existing evidence and learning infrastructure underneath.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Command Centre</Link>
              <Link to="/v2/intelligence" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">Intelligence</Link>
              <Link to="/v2/knowledge-memory" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Knowledge + Memory</Link>
              <Link to="/v2/foundation" className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Foundation</Link>
            </nav>
          </div>
        </header>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Intelligence loop</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Every stage has a distinct responsibility; no stage silently becomes another execution engine.</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stages.map((stage) => (
              <article key={stage.number} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                <div className="text-xs font-semibold tracking-[0.16em] text-[var(--text-secondary)]">{stage.number}</div>
                <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{stage.name}</h3>
                <div className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{stage.resource}</div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{stage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Signals', '0', 'Canonical V2 signal resources are the next persistence boundary.', 'Observe'],
            ['Insights', '0', 'Canonical V2 insight resources are derived from governed evidence.', 'Reason'],
            ['Recommendations', '0', 'Canonical V2 recommendation resources remain distinct from execution.', 'Recommend'],
            ['Predictions', '0', 'Prediction resources require explicit subject, horizon and probability.', 'Reason'],
          ].map(([label, value, detail, stage]) => (
            <article key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[var(--text-secondary)]">{label}</div>
                <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">{stage}</span>
              </div>
              <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Observed records', recordCounts.observe],
            ['Context records', recordCounts.understand],
            ['Reasoned records', recordCounts.reason],
            ['Governed decisions', recordCounts.recommend],
            ['Actions / executions', recordCounts.act],
            ['Learning signals', recordCounts.learn],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <div className="text-xs text-[var(--text-secondary)]">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Evidence feed</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Existing intelligence records are surfaced as evidence; V2 does not duplicate the ledger.</p>
            </div>
            <Link to="/history" className="text-xs font-medium text-[var(--text-primary)] underline-offset-4 hover:underline">Open full ledger →</Link>
          </div>
          <div className="mt-5">
            {recordsQuery.isLoading ? <p className="text-sm text-[var(--text-secondary)]">Loading intelligence evidence…</p> :
              recordsQuery.isError ? <p className="text-sm text-[var(--text-secondary)]">Intelligence evidence is unavailable for this Space.</p> :
              latestRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5">
                  <div className="font-medium text-[var(--text-primary)]">No intelligence records yet</div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">The Centre is connected to the existing ledger and will populate as intelligence engines produce governed records.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {latestRecords.map((record) => (
                    <article key={record.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--text-primary)]">{record.summary}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">{stageForRecord[record.recordType]} · {record.recordType} · {relativeTime(record.createdAt)}</div>
                      </div>
                      <span className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] text-[var(--text-secondary)] ${statusClass[record.status]}`}>{record.status}</span>
                    </article>
                  ))}
                </div>
              )}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Learning continuity</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Learning signals are evidence-grounded patterns from evaluated outcomes, not free-form model memory.</p>
          </div>
          <div className="mt-5">
            {learningQuery.isLoading ? <p className="text-sm text-[var(--text-secondary)]">Loading learning signals…</p> :
              learningQuery.isError ? <p className="text-sm text-[var(--text-secondary)]">Learning signals are unavailable for this Space.</p> :
              learningSignals.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">No learning signals yet.</p> :
              <div className="grid gap-3 md:grid-cols-2">
                {learningSignals.slice(0, 6).map((signal) => (
                  <article key={signal.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{signal.direction}</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">{signal.evidenceCount} evidence</span>
                    </div>
                    <h3 className="mt-2 font-medium text-[var(--text-primary)]">{signal.statement}</h3>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">{signal.recordType} · {signal.status} · {signal.strength}</p>
                  </article>
                ))}
              </div>}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Traceability</div><h2 className="mt-2 font-semibold text-[var(--text-primary)]">Evidence stays attached</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Existing ledger provenance remains the source of truth instead of introducing a parallel V2 provenance system.</p></article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Control</div><h2 className="mt-2 font-semibold text-[var(--text-primary)]">Intelligence does not execute itself</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Recommendations and decisions can feed the Command Centre; execution authority remains outside V2.</p></article>
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Boundary</div><h2 className="mt-2 font-semibold text-[var(--text-primary)]">Canonical V2 resources remain clean</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Signals, insights, recommendations and predictions are defined by the V2 contract and are not incorrectly mapped to unrelated legacy records.</p></article>
        </section>
      </div>
    </div>
  )
}
