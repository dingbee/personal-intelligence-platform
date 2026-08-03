import type { KnowledgeCollection } from '@/shared/types/database'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { ExportContent, ExportSection } from '@/modules/export/types'

const TYPE_LABEL: Record<string, string> = {
  document: 'Documents',
  note: 'Notes',
  conversation: 'Conversations',
  asset: 'Images',
  knowledge_node: 'Concepts',
}

/**
 * Pure — takes the already-fetched collection row and its already-resolved
 * `EvidenceItem[]` (the same data `KnowledgeCollectionDetailPage` already
 * has loaded via `useKnowledgeCollection`), grouping members by type the
 * same way that page's own rendering already does. Only `label`s (display
 * titles) and `createdAt` ever reach the result — no member ids, no
 * `user_id`/`workspace_id`.
 */
export function buildCollectionExportContent(
  collection: Pick<KnowledgeCollection, 'name' | 'description'>,
  items: EvidenceItem[],
): ExportContent {
  const byType = new Map<string, EvidenceItem[]>()
  for (const item of items) {
    const list = byType.get(item.type) ?? []
    list.push(item)
    byType.set(item.type, list)
  }

  const sections: ExportSection[] = Array.from(byType.entries()).map(([type, list]) => ({
    heading: TYPE_LABEL[type] ?? type,
    body: list.map((item) => `${item.label} (${new Date(item.createdAt).toLocaleDateString()})`),
    format: 'list',
  }))

  return { title: collection.name, subtitle: collection.description ?? undefined, sections }
}
