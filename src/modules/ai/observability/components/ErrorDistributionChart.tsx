import type { AiErrorCategory } from '@/modules/ai/orchestration/normalizeAiError'

const CATEGORY_LABELS: Record<AiErrorCategory, string> = {
  provider_unavailable: 'Provider unavailable',
  rate_limited: 'Rate limited',
  timeout: 'Timeout',
  invalid_response: 'Invalid response',
  unknown: 'Unknown',
}

/** Plain CSS bar chart (no charting library — none is installed, and this is simple enough not to need one) — bar width scaled to the largest category's count. */
export function ErrorDistributionChart({ groups }: { groups: { category: AiErrorCategory; count: number }[] }) {
  if (groups.length === 0) return null
  const max = Math.max(...groups.map((group) => group.count))

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.category} className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 truncate text-[var(--color-ink-muted)]">
            {CATEGORY_LABELS[group.category] ?? group.category}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${Math.max(4, (group.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium text-[var(--color-ink)]">{group.count}</span>
        </div>
      ))}
    </div>
  )
}
