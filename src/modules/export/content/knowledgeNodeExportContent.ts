import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { ExportContent, ExportSection } from '@/modules/export/types'

const SOURCE_TYPE_LABEL: Record<string, string> = { document: 'Documents', note: 'Notes', conversation: 'Conversations' }

/**
 * Pure — takes an already-fetched `KnowledgeNodeEvidence` (the same data
 * `KnowledgeNodeDetailPage` already has loaded), generalizing
 * `buildKnowledgeExportMarkdown`'s exact section structure (description,
 * Related Concepts, Evidence by source type) into the format-agnostic
 * `ExportContent` shape instead of markdown text directly. Only titles/
 * descriptions/relationship types/labels ever reach the result — no
 * node/source ids, no `source_chunk_ids`, no `generation_metadata`.
 */
export function buildKnowledgeNodeExportContent(evidence: KnowledgeNodeEvidence): ExportContent {
  const { node, evidence: items, relatedNodes, confidence } = evidence
  const sections: ExportSection[] = [{ body: [node.description ?? 'No description recorded.'] }]

  if (relatedNodes.length > 0) {
    sections.push({
      heading: 'Related Concepts',
      body: relatedNodes.map((related) => `${related.title} (${related.relationshipType.replace(/_/g, ' ')})`),
      format: 'list',
    })
  }

  const byType = new Map<string, typeof items>()
  for (const item of items) {
    const list = byType.get(item.type) ?? []
    list.push(item)
    byType.set(item.type, list)
  }
  for (const [type, list] of byType) {
    sections.push({
      heading: `Evidence — ${SOURCE_TYPE_LABEL[type] ?? type}`,
      body: list.map((item) => `${item.label} (${new Date(item.createdAt).toLocaleDateString()})`),
      format: 'list',
    })
  }

  return {
    title: node.title,
    subtitle: `${node.node_type === 'concept' ? 'Concept' : 'Entity'} · Knowledge Confidence: ${Math.round(confidence * 100)}%`,
    sections,
  }
}
