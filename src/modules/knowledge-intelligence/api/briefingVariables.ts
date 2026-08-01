import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { KnowledgeCollection } from '@/shared/types/database'

/**
 * Knowledge Actions v1 — Generate Briefing. Pure formatting of an already-
 * fetched KnowledgeNodeEvidence (plus, as of the UX-13 roadmap Phase 5
 * Executive Briefing command, the collections a concept belongs to) into
 * the variables the generate-briefing prompt template expects (see
 * module.ts). No I/O, no truncation logic beyond what's already bounded
 * upstream (evidence/relatedNodes/collections are small, node-scoped
 * lists, not full document content).
 */
export function buildBriefingVariables(
  evidence: KnowledgeNodeEvidence,
  collections: KnowledgeCollection[] = [],
): {
  title: string
  description: string
  relatedConcepts: string
  evidenceSources: string
  confidence: string
  collections: string
} {
  const { node, relatedNodes, evidence: items, confidence } = evidence

  const relatedConcepts =
    relatedNodes.length > 0
      ? relatedNodes.map((related) => `- ${related.title} (${related.relationshipType.replace(/_/g, ' ')})`).join('\n')
      : 'None recorded.'

  const evidenceSources =
    items.length > 0 ? items.map((item) => `- [${item.type}] ${item.label}`).join('\n') : 'None recorded.'

  const collectionsText = collections.length > 0 ? collections.map((collection) => `- ${collection.name}`).join('\n') : 'None.'

  return {
    title: node.title,
    description: node.description ?? 'No description recorded.',
    relatedConcepts,
    evidenceSources,
    confidence: `${Math.round(confidence * 100)}%`,
    collections: collectionsText,
  }
}
