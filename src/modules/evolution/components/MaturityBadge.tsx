import type { MaturityStage } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

const VARIANT_BY_STAGE: Record<MaturityStage, 'success' | 'info' | 'neutral' | 'warning' | 'error'> = {
  growing: 'success',
  active: 'info',
  mature: 'neutral',
  stagnant: 'warning',
  declining: 'error',
}

/** UX-13 — the five workspaceMaturity stages rendered with the same StatusBadge every other status pill in the app uses. */
export function MaturityBadge({ stage, label }: { stage: MaturityStage; label: string }) {
  return <StatusBadge label={label} variant={VARIANT_BY_STAGE[stage]} />
}
