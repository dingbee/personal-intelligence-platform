import { Link } from 'react-router-dom'
import { RecordTypeBadge } from '@/modules/intelligence-ledger/components/RecordTypeBadge'
import { RecordStatusBadge } from '@/modules/intelligence-ledger/components/RecordStatusBadge'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/**
 * One timeline entry — the card HistoryPage.tsx renders for every record,
 * newest first. Journey/parent/execution relationships are shown only
 * when the record's own real fields carry them (journeyId/parentRecordId/
 * executionRequestId) — never inferred, per the Ledger's own "never
 * fabricate lineage" rule (see ledger.ts).
 */
export function IntelligenceRecordCard({ record }: { record: IntelligenceRecord }) {
  return (
    <li>
      <Link
        to={`/history/records/${record.id}`}
        className="block rounded-card border border-[var(--color-border)] bg-[var(--surface-raised)] p-4 shadow-raised transition-shadow hover:shadow-floating"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <RecordTypeBadge recordType={record.recordType} />
          <RecordStatusBadge status={record.status} />
          <span className="ml-auto shrink-0 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(record.createdAt)}</span>
        </div>

        <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{record.summary}</p>

        {(record.journeyId || record.parentRecordId || record.executionRequestId) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)]">
            {record.journeyId && <span>Part of a journey</span>}
            {record.parentRecordId && <span>Derived from a prior record</span>}
            {record.executionRequestId && <span>Linked to an execution</span>}
          </div>
        )}
      </Link>
    </li>
  )
}
