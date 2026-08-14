import type { KnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import type { EvidenceReference, SourceReference, SourceType } from '@/shared/provenance/types'

const KNOWN_SOURCE_TYPES: ReadonlySet<string> = new Set<SourceType>(['document', 'note', 'conversation', 'asset', 'knowledge_node', 'dataset', 'external'])

/**
 * Knowledge Intelligence -> shared provenance adapter. Takes an already-
 * fetched KnowledgeNodeEvidence (from the real, RLS-protected
 * getKnowledgeNodeEvidence — this adapter never queries Supabase itself)
 * and maps the node itself to a SourceReference, and each EvidenceItem
 * (a document/note/conversation that cites the node, via
 * knowledge_node_sources) to an EvidenceReference. `location` is always
 * 'whole': knowledge_node_sources records only that a source referenced
 * a node, never a chunk/row/region within it — the existing table
 * genuinely carries no finer-grained location, so 'whole' is the honest
 * answer, not a placeholder.
 *
 * An EvidenceItem whose `type` is not one of the shared model's known
 * SourceTypes is skipped rather than guessed at — defensive, matching
 * every other adapter's "drop what can't be honestly represented" rule.
 */
export function knowledgeNodeEvidenceToProvenance(evidence: KnowledgeNodeEvidence): { source: SourceReference; items: EvidenceReference[] } {
  const source: SourceReference = { type: 'knowledge_node', id: evidence.node.id, title: evidence.node.title }

  const items: EvidenceReference[] = evidence.evidence
    .filter((item) => KNOWN_SOURCE_TYPES.has(item.type))
    .map((item) => ({
      id: `${item.type}:${item.id}`,
      source: { type: item.type as SourceType, id: item.id, title: item.label },
      location: { kind: 'whole' },
      excerpt: null,
      retrievedAt: item.createdAt,
    }))

  return { source, items }
}
