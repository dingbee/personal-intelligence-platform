import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import type { EvidenceLevel } from '@/modules/intelligence/evidence/computeEvidenceScore'

const VARIANT: Record<EvidenceLevel, 'success' | 'info' | 'neutral'> = {
  High: 'success',
  Medium: 'info',
  Low: 'neutral',
}

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  return <StatusBadge label={`Evidence: ${level}`} variant={VARIANT[level]} />
}
