import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { RECORD_STATUS_LABEL, RECORD_STATUS_VARIANT } from '@/modules/intelligence-ledger/recordDisplay'
import type { IntelligenceRecordStatus } from '@/shared/types/database'

export function RecordStatusBadge({ status }: { status: IntelligenceRecordStatus }) {
  return <StatusBadge label={RECORD_STATUS_LABEL[status]} variant={RECORD_STATUS_VARIANT[status]} />
}
