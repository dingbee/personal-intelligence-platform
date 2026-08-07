import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/**
 * Knowledge Intelligence Layer v1, Feature 4 — "how has my thinking
 * changed about this?" No new table, no new query: `knowledge_node_sources
 * .created_at` (already fetched as `EvidenceItem.createdAt` by
 * `getKnowledgeNodeEvidence`) is already a real, timestamped record of
 * every moment a source added weight to this concept — this just groups
 * that existing evidence into calendar-month buckets and orders it
 * earliest-first, so it reads as progression ("January: ... → March: ...")
 * rather than a flat "most recent first" activity list.
 *
 * UTC-based (not local time / `toLocaleDateString`) so grouping is
 * deterministic regardless of the runtime's timezone — this is a pure
 * function with no rendering concerns, display formatting happens
 * separately in the UI layer that consumes it.
 */
export interface KnowledgeTimelinePeriod {
  /** Sortable key, e.g. "2026-01". */
  key: string
  /** Human label, e.g. "January 2026". */
  label: string
  items: EvidenceItem[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function periodKeyAndLabel(createdAt: string): { key: string; label: string } {
  const date = new Date(createdAt)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  return { key: `${year}-${String(month + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[month]} ${year}` }
}

export function groupEvidenceByPeriod(evidence: EvidenceItem[]): KnowledgeTimelinePeriod[] {
  const byKey = new Map<string, KnowledgeTimelinePeriod>()

  for (const item of evidence) {
    const { key, label } = periodKeyAndLabel(item.createdAt)
    const existing = byKey.get(key)
    if (existing) {
      existing.items.push(item)
    } else {
      byKey.set(key, { key, label, items: [item] })
    }
  }

  const periods = Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key))
  for (const period of periods) {
    period.items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }
  return periods
}
