import type { AttentionItem, AttentionPriority } from '@/modules/intelligence/orchestrator/types'

const PRIORITY_ORDER: Record<AttentionPriority, number> = { high: 0, medium: 1, low: 2 }

/**
 * Capability Audit #12, item #2 — `priority` was already on every
 * AttentionItem and already consumed by the Dashboard's
 * AttentionCenterSection (which pre-filters into same-priority groups
 * before calling this component), but this, the Chat/Nova drawer's
 * consumer, ignored it entirely and rendered items in whatever order the
 * orchestrator produced them — so a high-priority item (e.g. contradictory
 * memory) could sit below a low-priority one.
 *
 * Sorting here — rather than adding grouping/color, which would change
 * AttentionCenterSection's rendering too, since it reuses this exact
 * component — is a no-op for that caller: each of its calls already
 * receives an already-filtered, single-priority array, so a stable sort
 * over uniform priorities can't reorder it. This only changes the
 * Chat/Nova drawer's genuinely-mixed-priority list.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  const sorted = items.toSorted((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <ul className="flex flex-col gap-1 text-xs text-[var(--color-warning-strong)]">
      {sorted.map((item, index) => (
        <li key={`${item.type}-${index}`}>⚠ {item.message}</li>
      ))}
    </ul>
  )
}
