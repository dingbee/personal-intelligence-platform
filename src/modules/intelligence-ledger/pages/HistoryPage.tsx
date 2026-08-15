import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useIntelligenceRecords } from '@/modules/intelligence-ledger/hooks/useIntelligenceRecords'
import { useIntelligenceJourneys } from '@/modules/intelligence-ledger/hooks/useIntelligenceJourneys'
import { IntelligenceRecordCard } from '@/modules/intelligence-ledger/components/IntelligenceRecordCard'
import { RECORD_STATUSES, RECORD_STATUS_LABEL, RECORD_TYPES, RECORD_TYPE_LABEL } from '@/modules/intelligence-ledger/recordDisplay'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { IntelligenceRecordStatus, IntelligenceRecordType } from '@/shared/types/database'

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * ARRIYIA History — the user-facing surface over the Intelligence Ledger
 * built in a prior workstream (see src/modules/intelligence-ledger/api/
 * ledgerQueries.ts, previously unconsumed by any UI). Timeline is the
 * default view; Journeys is a same-page tab, mirroring LibraryPage.tsx's
 * own Documents/Images tab convention rather than a second nav entry.
 */
export function HistoryPage() {
  const { currentWorkspaceId } = useWorkspace()
  const [activeTab, setActiveTab] = useState<'timeline' | 'journeys'>('timeline')
  const [typeFilter, setTypeFilter] = useState<IntelligenceRecordType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<IntelligenceRecordStatus | 'all'>('all')

  const records = useIntelligenceRecords(currentWorkspaceId)
  const journeys = useIntelligenceJourneys(currentWorkspaceId)

  const filteredRecords = useMemo(() => {
    const data = records.data ?? []
    return data.filter((record) => (typeFilter === 'all' || record.recordType === typeFilter) && (statusFilter === 'all' || record.status === statusFilter))
  }, [records.data, typeFilter, statusFilter])

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        level="page"
        title="History"
        description="Your intelligence, decisions and actions — connected over time."
      />

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(['timeline', 'journeys'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
              {RECORD_TYPES.map((type) => (
                <FilterChip key={type} label={RECORD_TYPE_LABEL[type]} active={typeFilter === type} onClick={() => setTypeFilter(type)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label="Any status" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              {RECORD_STATUSES.map((status) => (
                <FilterChip key={status} label={RECORD_STATUS_LABEL[status]} active={statusFilter === status} onClick={() => setStatusFilter(status)} />
              ))}
            </div>
          </div>

          {records.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : records.isError ? (
            <EmptyState
              title="History couldn't be loaded"
              description="Something went wrong while loading your intelligence history."
              action={<Button variant="secondary" onClick={() => void records.refetch()}>Retry</Button>}
            />
          ) : (records.data ?? []).length === 0 ? (
            <EmptyState
              title="Your intelligence history will appear here"
              description="As ARRIYIA works with you, important research, analysis, plans, decisions and actions will be preserved here."
            />
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              title="No records match these filters"
              description="Try a different record type or status, or clear the filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTypeFilter('all')
                    setStatusFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {filteredRecords.map((record) => (
                <IntelligenceRecordCard key={record.id} record={record} />
              ))}
            </ul>
          )}
        </>
      ) : journeys.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : journeys.isError ? (
        <EmptyState
          title="Journeys couldn't be loaded"
          description="Something went wrong while loading your intelligence journeys."
          action={<Button variant="secondary" onClick={() => void journeys.refetch()}>Retry</Button>}
        />
      ) : (journeys.data ?? []).length === 0 ? (
        <EmptyState
          title="No journeys yet"
          description="A journey groups the intelligence work behind one coherent question or objective, once ARRIYIA starts threading records together."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {journeys.data!.map((journey) => (
            <li key={journey.id}>
              <Link
                to={`/history/journeys/${journey.id}`}
                className="block rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4 shadow-raised transition-shadow hover:shadow-floating"
              >
                <p className="text-sm font-medium text-[var(--color-ink)]">{journey.title}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(journey.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
