import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useIntelligenceJourney } from '@/modules/intelligence-ledger/hooks/useIntelligenceJourney'
import { useJourneyRecords } from '@/modules/intelligence-ledger/hooks/useJourneyRecords'
import { getWorkspaceObjective } from '@/modules/hub/api/objectives'
import { RecordTypeBadge } from '@/modules/intelligence-ledger/components/RecordTypeBadge'
import { RecordStatusBadge } from '@/modules/intelligence-ledger/components/RecordStatusBadge'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/** A journey's own metadata — reuses the existing, already-authorized workspace objectives read, not a parallel query. */
function useJourneyObjective(objectiveId: string | null) {
  return useQuery({
    queryKey: ['journey-objective', objectiveId],
    queryFn: () => getWorkspaceObjective(objectiveId!),
    enabled: Boolean(objectiveId),
  })
}

function findParentInJourney(record: IntelligenceRecord, records: IntelligenceRecord[]): IntelligenceRecord | null {
  if (!record.parentRecordId) return null
  return records.find((r) => r.id === record.parentRecordId) ?? null
}

/**
 * A coherent piece of intelligence work (sprint brief §8), shown as its
 * own chronological chain — journey membership is the list itself
 * (journey_id), parent/child lineage is called out per-record only when
 * a real parent_record_id points at another record in this same journey.
 * Never fabricated or inferred from adjacency alone.
 */
export function IntelligenceJourneyDetailPage() {
  const { journeyId } = useParams<{ journeyId: string }>()
  const journey = useIntelligenceJourney(journeyId ?? null)
  const records = useJourneyRecords(journeyId ?? null)
  const objective = useJourneyObjective(journey.data?.objectiveId ?? null)

  if (journey.isLoading || records.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (journey.isError || !journey.data) {
    return (
      <EmptyState
        title="Journey not found"
        description="It may have been removed, or the link is out of date."
        action={
          <Link to="/history">
            <Button variant="secondary">Back to History</Button>
          </Link>
        }
      />
    )
  }

  const recordList = records.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <Link to="/history" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to History
      </Link>

      <div>
        <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">Journey</span>
        <h1 className="mt-1.5 text-2xl font-semibold text-[var(--color-ink)]">{journey.data.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Started {formatRelativeTime(journey.data.createdAt)}</p>
        {objective.data && (
          <p className="mt-2 text-sm text-[var(--color-ink)]">
            <span className="text-[var(--color-ink-muted)]">Objective: </span>
            {objective.data.content}
          </p>
        )}
      </div>

      <SectionHeader title="Progression" description={`${recordList.length} record${recordList.length === 1 ? '' : 's'}, earliest first.`} />

      {recordList.length === 0 ? (
        <EmptyState title="No records in this journey yet" />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {recordList.map((record, index) => {
            const parent = findParentInJourney(record, recordList)
            return (
              <li key={record.id}>
                <SurfaceCard padding="sm" className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[var(--color-ink-muted)]">{index + 1}.</span>
                    <RecordTypeBadge recordType={record.recordType} />
                    <RecordStatusBadge status={record.status} />
                    <span className="ml-auto shrink-0 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(record.createdAt)}</span>
                  </div>
                  <Link to={`/history/records/${record.id}`} className="text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                    {record.summary}
                  </Link>
                  {parent && <p className="text-xs text-[var(--color-ink-muted)]">↳ derived from "{parent.summary}"</p>}
                </SurfaceCard>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
