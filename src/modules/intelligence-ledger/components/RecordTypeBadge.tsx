import { RECORD_TYPE_LABEL } from '@/modules/intelligence-ledger/recordDisplay'
import type { IntelligenceRecordType } from '@/shared/types/database'

/** A neutral type pill — matches ActionsPage.tsx's own TYPE_LABEL badge convention (color is reserved for status, not category). */
export function RecordTypeBadge({ recordType }: { recordType: IntelligenceRecordType }) {
  return (
    <span className="inline-flex rounded-pill bg-[var(--color-ink-muted)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
      {RECORD_TYPE_LABEL[recordType]}
    </span>
  )
}
