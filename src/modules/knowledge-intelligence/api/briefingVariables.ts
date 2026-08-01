import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'

/**
 * Knowledge Actions v1 — Generate Briefing. Pure formatting of an already-
 * fetched KnowledgeNodeEvidence into the {{description}}/{{relatedConcepts}}/
 * {{evidenceSources}} variables the generate-briefing prompt template
 * expects (see module.ts). No I/O, no truncation logic beyond what's
 * already bounded upstream (evidence/relatedNodes are small, node-scoped
 * lists, not full document content).
 */
export function buildBriefingVariables(evidence: KnowledgeNodeEvidence): {
  title: string
  description: string
  relatedConcepts: string
  evidenceSources: string
} {
  const { node, relatedNodes, evidence: items } = evidence

  const relatedConcepts =
    relatedNodes.length > 0
      ? relatedNodes.map((related) => `- ${related.title} (${related.relationshipType.replace(/_/g, ' ')})`).join('\n')
      : 'None recorded.'

  const evidenceSources =
    items.length > 0 ? items.map((item) => `- [${item.type}] ${item.label}`).join('\n') : 'None recorded.'

  return {
    title: node.title,
    description: node.description ?? 'No description recorded.',
    relatedConcepts,
    evidenceSources,
  }
}
