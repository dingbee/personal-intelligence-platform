import type { Forecast, ForecastConfidence } from '@/modules/evolution/knowledgeForecast/knowledgeForecast'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const CONFIDENCE_VARIANT: Record<ForecastConfidence, 'success' | 'info' | 'neutral'> = {
  high: 'success',
  medium: 'info',
  low: 'neutral',
}

/** UX-13 Knowledge Forecast — every statement here traces back to a deterministic threshold (see knowledgeForecast.ts); the confidence badge communicates how strong the underlying signal was, not a probability. */
export function KnowledgeForecastSection({ forecasts }: { forecasts: Forecast[] }) {
  if (forecasts.length === 0) {
    return <EmptyState title="No forecasts yet" description="Forecasts appear once there's enough activity to spot a trend." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {forecasts.map((forecast, index) => (
        <li key={index} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--color-ink)]">{forecast.message}</span>
          <StatusBadge label={forecast.confidence} variant={CONFIDENCE_VARIANT[forecast.confidence]} />
        </li>
      ))}
    </ul>
  )
}
