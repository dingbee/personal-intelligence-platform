import { Link, useParams } from 'react-router-dom'
import { useKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/hooks/useKnowledgeNodeEvidence'
import { useGenerateBriefing } from '@/modules/knowledge-intelligence/hooks/useGenerateBriefing'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { buildKnowledgeExportMarkdown, knowledgeExportFilename } from '@/modules/knowledge-intelligence/api/knowledgeExportMarkdown'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { ConfidenceBadge } from '@/shared/components/knowledge/ConfidenceBadge'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { downloadTextFile } from '@/shared/utils/downloadTextFile'

const SOURCE_TYPE_LABEL: Record<string, string> = { document: 'Documents', note: 'Notes', conversation: 'Conversations' }

/**
 * UX-13.11 Phase 2B — the drill-down a Concept Card links into: overview
 * counts, related concepts (from knowledge_links), every document/note/
 * conversation that references it (from knowledge_node_sources), and a
 * chronological view of the same evidence. The seed of the Knowledge
 * Graph UI called for in the phase spec — deliberately built from the
 * existing SourceReference/ConfidenceBadge/StatCard/SectionHeader
 * primitives rather than new ones.
 */
export function KnowledgeNodeDetailPage() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const { data: evidence, isLoading, isError } = useKnowledgeNodeEvidence(nodeId!)
  const generateBriefing = useGenerateBriefing(nodeId!)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (isError || !evidence) {
    return (
      <EmptyState
        title="Concept not found"
        description="It may have been merged into another concept, or the link is out of date."
        action={
          <Link to="/knowledge/explorer">
            <Button variant="secondary">Back to Explorer</Button>
          </Link>
        }
      />
    )
  }

  const { node, countsBySourceType, evidence: items, relatedNodes, confidence } = evidence
  const countEntries = Object.entries(countsBySourceType).filter(([, count]) => count > 0)

  const evidenceByType = new Map<string, EvidenceItem[]>()
  for (const item of items) {
    const list = evidenceByType.get(item.type) ?? []
    list.push(item)
    evidenceByType.set(item.type, list)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/knowledge/explorer" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to Explorer
      </Link>

      <div>
        <span className="inline-block rounded bg-[var(--color-canvas)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-muted)]">
          {node.node_type === 'concept' ? 'Concept' : 'Entity'}
        </span>
        <h1 className="mt-1.5 text-2xl font-semibold text-[var(--color-ink)]">{node.title}</h1>
        {node.description && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{node.description}</p>}
      </div>

      {/* UX-13 roadmap Phase 2 — Knowledge Confidence: "how sure are we", not just "here are the documents". Deterministic (source count + diversity + freshness + relationship density), see computeKnowledgeConfidence. */}
      <StatCard label="Knowledge Confidence" value={`${Math.round(confidence * 100)}%`} />

      {/* Knowledge Actions v1 — "knowledge stops being passive": act on a concept, not just view it. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" loading={generateBriefing.isPending} onClick={() => generateBriefing.mutate()}>
          Generate briefing
        </Button>
        <Button
          variant="secondary"
          onClick={() => downloadTextFile(knowledgeExportFilename(node.title), buildKnowledgeExportMarkdown(evidence))}
        >
          Export knowledge package
        </Button>
        {generateBriefing.isSuccess && generateBriefing.data && (
          <Link to={`/notes/${generateBriefing.data.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
            Briefing saved as a note →
          </Link>
        )}
        {generateBriefing.isError && (
          <span className="text-sm text-red-600">
            {generateBriefing.error instanceof Error ? generateBriefing.error.message : 'Failed to generate briefing.'}
          </span>
        )}
      </div>

      {countEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="Overview" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {countEntries.map(([type, count]) => (
              <StatCard key={type} variant="inset" label={SOURCE_TYPE_LABEL[type] ?? type} value={count} />
            ))}
          </div>
        </div>
      )}

      {relatedNodes.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="Related concepts" />
          <ul className="flex flex-col gap-1.5">
            {relatedNodes.map((related) => (
              <li key={related.nodeId} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  to={`/knowledge/nodes/${related.nodeId}`}
                  className="min-w-0 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                >
                  {related.relationshipType.replace(/_/g, ' ')} → {related.title}
                </Link>
                <ConfidenceBadge confidence={related.confidence} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.from(evidenceByType.entries()).map(([type, list]) => (
        <div key={type} className="flex flex-col gap-3">
          <SectionHeader title={SOURCE_TYPE_LABEL[type] ?? type} />
          <SourceReference sources={list} />
        </div>
      ))}

      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="Timeline" />
          <ul className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
            {items.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                Mentioned in <span className="text-[var(--color-ink)]">{item.label}</span> — {formatRelativeTime(item.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 && relatedNodes.length === 0 && (
        <EmptyState
          title="No evidence yet"
          description="This concept hasn't been linked to any documents, notes, or conversations yet."
        />
      )}
    </div>
  )
}
