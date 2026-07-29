import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

/** UX-6/UX-8 signals — informational only. First rendered in the UI here; UX-6/7 computed them but never displayed them. */
export function SignalList({ signals }: { signals: IntelligenceSignal[] }) {
  if (signals.length === 0) return null

  return (
    <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
      {signals.map((signal, index) => (
        <li key={`${signal.type}-${index}`}>· {signal.message}</li>
      ))}
    </ul>
  )
}
