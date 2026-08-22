import { Link, useParams } from 'react-router-dom'
import { useIntelligenceRecord } from '@/modules/intelligence-ledger/hooks/useIntelligenceRecord'
import { useChildRecords } from '@/modules/intelligence-ledger/hooks/useChildRecords'
import { RecordTypeBadge } from '@/modules/intelligence-ledger/components/RecordTypeBadge'
import { RecordStatusBadge } from '@/modules/intelligence-ledger/components/RecordStatusBadge'
import { StructuredOutputView } from '@/modules/intelligence-ledger/components/StructuredOutputView'
import { RecordProvenanceView } from '@/modules/intelligence-ledger/components/RecordProvenanceView'
import { RecordOutcomeSection } from '@/modules/intelligence-ledger/components/RecordOutcomeSection'
import { RECORD_TYPE_LABEL } from '@/modules/intelligence-ledger/recordDisplay'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'

/**
 * One Intelligence Ledger record's full detail — a dedicated route (not a
 * drawer/dialog), matching DocumentDetailPage.tsx/NoteDetailPage.tsx/
 * KnowledgeNodeDetailPage.tsx's own established "click a card -> dedicated
 * page" convention rather than introducing a new interaction pattern.
 */
export function IntelligenceRecordDetailPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const { data: record, isLoading, isError, refetch } = useIntelligenceRecord(recordId ?? null)
  const { data: parent } = useIntelligenceRecord(record?.parentRecordId ?? null)
  const { data: children } = useChildRecords(record?.id ?? null)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !record) {
    return (
      <EmptyState
        title="Record not found"
        description="It may have been superseded, archived, or the link is out of date."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void refetch()}>Retry</Button>
            <Link to="/history">
              <Button variant="secondary">Back to History</Button>
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/history" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to History
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <RecordTypeBadge recordType={record.recordType} />
          <RecordStatusBadge status={record.status} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{record.summary}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{new Date(record.createdAt).toLocaleString()}</p>
      </div>

      {(record.journeyId || parent || record.executionRequestId) && (
        <SurfaceCard className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Connections</p>
          {record.journeyId && (
            <p className="text-sm">
              Part of a journey —{' '}
              <Link to={`/history/journeys/${record.journeyId}`} className="text-[var(--color-accent)] hover:underline">
                view journey
              </Link>
            </p>
          )}
          {parent && (
            <p className="text-sm">
              Derived from{' '}
              <Link to={`/history/records/${parent.id}`} className="text-[var(--color-accent)] hover:underline">
                {parent.summary}
              </Link>
            </p>
          )}
          {record.executionRequestId && (
            <p className="text-sm">
              Linked to an execution —{' '}
              <Link to="/executions" className="text-[var(--color-accent)] hover:underline">
                view in Executions
              </Link>
            </p>
          )}
        </SurfaceCard>
      )}

      {record.expectedOutcome && (
        <SurfaceCard>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Expected outcome</p>
          <p className="mt-1 text-sm text-[var(--color-ink)]">{record.expectedOutcome}</p>
        </SurfaceCard>
      )}

      <RecordOutcomeSection record={record} />

      <SurfaceCard>
        <SectionHeader title="Details" />
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Type</dt>
            <dd className="mt-0.5 text-sm text-[var(--color-ink)]">{RECORD_TYPE_LABEL[record.recordType]}</dd>
          </div>
          {record.providerId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Provider</dt>
              <dd className="mt-0.5 text-sm text-[var(--color-ink)]">{record.providerId}</dd>
            </div>
          )}
          {record.operationId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Operation ID</dt>
              <dd className="mt-0.5 truncate text-sm text-[var(--color-ink)]" title={record.operationId}>
                {record.operationId}
              </dd>
            </div>
          )}
        </dl>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="What ARRIYIA produced" />
        <div className="mt-3">
          <StructuredOutputView data={record.structuredOutput} />
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="Provenance" description="What this record's conclusions were grounded in." />
        <div className="mt-3">
          <RecordProvenanceView record={record} />
        </div>
      </SurfaceCard>

      {children && children.length > 0 && (
        <SurfaceCard>
          <SectionHeader title="What came after this" />
          <ul className="mt-3 flex flex-col gap-1.5">
            {children.map((child) => (
              <li key={child.id} className="text-sm">
                <Link to={`/history/records/${child.id}`} className="text-[var(--color-accent)] hover:underline">
                  {child.summary}
                </Link>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}
    </div>
  )
}
