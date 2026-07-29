import type { AttentionItem } from '@/modules/intelligence/orchestrator/types'

/** UX-8 Phase 3/9 — informational only, plain text lines (no dismiss/act affordance, since attention items are never auto-acted-on). */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <ul className="flex flex-col gap-1 text-xs text-amber-700">
      {items.map((item) => (
        <li key={item.type}>⚠ {item.message}</li>
      ))}
    </ul>
  )
}
