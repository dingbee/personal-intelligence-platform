import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

const SOURCE_TYPE_LABEL: Record<string, string> = { document: 'Documents', note: 'Notes', conversation: 'Conversations' }

/**
 * Knowledge Actions v1 — Export Knowledge Package. Fully deterministic,
 * client-side markdown rendering of a node's already-fetched evidence —
 * no AI call, no server round trip, so "export" is instant and never
 * fails for a reason unrelated to the data already on screen.
 */
export function buildKnowledgeExportMarkdown(evidence: KnowledgeNodeEvidence): string {
  const { node, evidence: items, relatedNodes, confidence } = evidence
  const lines: string[] = []

  lines.push(`# ${node.title}`)
  lines.push('')
  lines.push(`_${node.node_type === 'concept' ? 'Concept' : 'Entity'} · Knowledge Confidence: ${Math.round(confidence * 100)}%_`)
  lines.push('')
  lines.push(node.description ?? '_No description recorded._')

  if (relatedNodes.length > 0) {
    lines.push('')
    lines.push('## Related Concepts')
    for (const related of relatedNodes) {
      lines.push(`- ${related.title} (${related.relationshipType.replace(/_/g, ' ')})`)
    }
  }

  const byType = new Map<string, typeof items>()
  for (const item of items) {
    const list = byType.get(item.type) ?? []
    list.push(item)
    byType.set(item.type, list)
  }

  if (byType.size > 0) {
    lines.push('')
    lines.push('## Evidence')
    for (const [type, list] of byType) {
      lines.push('')
      lines.push(`### ${SOURCE_TYPE_LABEL[type] ?? type}`)
      for (const item of list) {
        lines.push(`- ${item.label} (${new Date(item.createdAt).toLocaleDateString()})`)
      }
    }
  }

  return lines.join('\n')
}

/** Filesystem-safe, lowercase-hyphenated filename for a node's export — mirrors normalizeTitle's spirit without needing to import it (no dedup-key semantics here, just a legible filename). */
export function knowledgeExportFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'knowledge-export'}.md`
}
