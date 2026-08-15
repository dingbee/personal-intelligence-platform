import { Link } from 'react-router-dom'
import { SourceReference, type SourceReferenceItem } from '@/shared/components/knowledge/SourceReference'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import type { ProvenanceChain } from '@/shared/provenance/types'
import type { ExecutionProvenance } from '@/shared/provenance/adapters/executionAdapter'

const DERIVATION_KIND_LABEL: Record<string, string> = {
  calculation: 'Calculation',
  aggregation: 'Aggregation',
  comparison: 'Comparison',
  observation: 'Observation',
  synthesis: 'Synthesis',
  interpretation: 'Interpretation',
}

function ChainProvenanceView({ provenance }: { provenance: ProvenanceChain }) {
  const sources: SourceReferenceItem[] = provenance.evidence.map((item) => ({ type: item.source.type, id: item.source.id, label: item.source.title }))
  const evidenceWithExcerpts = provenance.evidence.filter((item) => item.excerpt)

  if (provenance.evidence.length === 0 && provenance.derivations.length === 0) {
    return <p className="text-sm text-[var(--color-ink-muted)]">No provenance was recorded for this record.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {sources.length > 0 && (
        <div>
          <SourceReference sources={sources} label="Evidence:" />
          {evidenceWithExcerpts.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {evidenceWithExcerpts.map((item) => (
                <li key={item.id} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2 text-xs text-[var(--color-ink-muted)]">
                  <span className="font-medium text-[var(--color-ink)]">{item.source.title}: </span>
                  {item.excerpt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {provenance.derivations.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">How it was derived</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {provenance.derivations.map((derivation) => (
              <li key={derivation.id} className="text-sm text-[var(--color-ink)]">
                <span className="mr-1.5 inline-flex rounded-pill bg-[var(--color-ink-muted)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
                  {DERIVATION_KIND_LABEL[derivation.kind] ?? derivation.kind}
                </span>
                {derivation.statement}
                {derivation.method && <span className="ml-1 text-xs text-[var(--color-ink-muted)]">({derivation.method})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ExecutionProvenanceView({ provenance }: { provenance: ExecutionProvenance }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Origin</p>
        <p className="mt-0.5 text-[var(--color-ink)]">
          {provenance.source.kind === 'action' ? `Proposed by Action Intelligence (${provenance.source.actionSource.label})` : provenance.source.label}
        </p>
      </div>

      {provenance.authorization && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Authorization</p>
          <p className="mt-0.5 text-[var(--color-ink)]">
            {provenance.authorization.decision === 'approved' ? 'Approved' : 'Rejected'} {formatRelativeTime(provenance.authorization.grantedAt)}
          </p>
        </div>
      )}

      {provenance.attempts.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Attempts</p>
          <ul className="mt-1 flex flex-col gap-1">
            {provenance.attempts.map((attempt) => (
              <li key={attempt.attemptNumber} className="text-[var(--color-ink)]">
                Attempt {attempt.attemptNumber}: {attempt.outcome ?? 'in progress'}
                {attempt.failureKind && <span className="text-[var(--color-ink-muted)]"> ({attempt.failureKind})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-[var(--color-ink-muted)]">
        Full authorization, attempt, and audit-event detail lives in{' '}
        <Link to="/executions" className="text-[var(--color-accent)] hover:underline">
          Executions
        </Link>
        .
      </p>
    </div>
  )
}

/** Renders whichever of the Ledger's two provenance shapes this record carries — see ledger.ts's own doc comment on why 'execution' uses a distinct shape from the other six record types. */
export function RecordProvenanceView({ record }: { record: IntelligenceRecord }) {
  if (!record.provenance) {
    return <p className="text-sm text-[var(--color-ink-muted)]">No provenance was recorded for this record.</p>
  }
  if (record.recordType === 'execution') {
    return <ExecutionProvenanceView provenance={record.provenance as ExecutionProvenance} />
  }
  return <ChainProvenanceView provenance={record.provenance as ProvenanceChain} />
}
