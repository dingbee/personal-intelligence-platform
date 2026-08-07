import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/hooks/useKnowledgeNodeEvidence'
import { useGenerateBriefing } from '@/modules/knowledge-intelligence/hooks/useGenerateBriefing'
import { AddToCollectionButton } from '@/modules/knowledge-intelligence/components/AddToCollectionButton'
import type { EvidenceItem } from '@/modules/knowledge-intelligence/api/knowledgeNodeEvidence'
import { groupEvidenceByPeriod } from '@/modules/knowledge-intelligence/timeline/knowledgeTimeline'
import { IntelligenceQueryBox } from '@/modules/knowledge-intelligence/components/IntelligenceQueryBox'
import { buildKnowledgeExportMarkdown, knowledgeExportFilename } from '@/modules/knowledge-intelligence/api/knowledgeExportMarkdown'
import { exportKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/exportKnowledgeNodePackage'
import { exportKnowledgeLinkPackage, knowledgeLinkPackageFilename } from '@/modules/knowledge-exchange/knowledge-links/exportKnowledgeLinkPackage'
import { fetchKnowledgeLinkForExport } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkFetch'
import { buildKnowledgeNodeExportContent } from '@/modules/export/content/knowledgeNodeExportContent'
import { KnowledgeExportDialog } from '@/modules/export/components/KnowledgeExportDialog'
import { exportFilename } from '@/modules/export/types'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { ConfidenceBadge } from '@/shared/components/knowledge/ConfidenceBadge'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { Button } from '@/shared/components/ui/Button'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { downloadTextFile } from '@/shared/utils/downloadTextFile'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'

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
  const { createConversationWithQuery } = useCommandActions()
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // UX-14.5.10.4 — the one place this package type does I/O before
  // building its (otherwise pure/synchronous) package: fetch the
  // knowledge_links row between these two nodes plus the related node's
  // full data, then build the package. `evidence!.node` is safe here —
  // this mutation is only ever invoked from a click inside the
  // "related concepts" list below, which only renders once `evidence`
  // has already loaded.
  const exportLink = useMutation({
    mutationFn: async (relatedNodeId: string) => {
      const { link, sourceNode, targetNode } = await fetchKnowledgeLinkForExport({ currentNode: evidence!.node, relatedNodeId })
      return exportKnowledgeLinkPackage({ link, sourceNode, targetNode })
    },
    onSuccess: (pkg) => {
      downloadTextFile(
        knowledgeLinkPackageFilename(pkg.link.source.title, pkg.link.target.title),
        JSON.stringify(pkg, null, 2),
        'application/json',
      )
    },
  })

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

      {/* Knowledge Intelligence Layer v1, Feature 5 — Intelligence Queries. */}
      <IntelligenceQueryBox nodeId={node.id} />

      {/* Knowledge Actions v1 — "knowledge stops being passive": act on a concept, not just view it. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" loading={generateBriefing.isPending} onClick={() => generateBriefing.mutate()}>
          Generate briefing
        </Button>
        {/* UX-15.1 — renamed from "Export knowledge package" to
            distinguish it from "Save As…" below: this is the older,
            separately-shipped Knowledge Actions v1 briefing (always
            markdown, always this exact evidence structure), not a
            format choice. Kept functionally unchanged. */}
        <Button
          variant="secondary"
          onClick={() => downloadTextFile(knowledgeExportFilename(node.title), buildKnowledgeExportMarkdown(evidence))}
        >
          Export Briefing (Markdown)
        </Button>
        {/* UX-14.5.11 — the unified Save As / Download experience: NOVA
            Package (this node's existing, unmodified
            `exportKnowledgeNodePackage`), PDF, Markdown, or Word. */}
        <Button variant="secondary" onClick={() => setExportDialogOpen(true)}>
          Save As…
        </Button>
        <AddToCollectionButton itemType="knowledge_node" itemId={node.id} />
        {/* UX-15.1 — converges "Ask AI" onto the one mechanism/label
            every other object type's own entry point uses
            (`createConversationWithQuery`, same as Assets/Notes). */}
        <Button variant="ghost" onClick={() => void createConversationWithQuery(`I'd like to talk about a concept called "${node.title}".`)}>
          Ask NOVA about this concept
        </Button>
        {generateBriefing.isSuccess && generateBriefing.data && (
          <Link to={`/notes/${generateBriefing.data.id}`} className="text-sm text-[var(--color-accent)] hover:underline">
            Briefing saved as a note →
          </Link>
        )}
        {generateBriefing.isError && (
          <span className="text-sm text-[var(--color-danger)]">
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
          {exportLink.isError && (
            <p className="text-sm text-[var(--color-danger)]">
              {exportLink.error instanceof Error ? exportLink.error.message : 'Failed to export this relationship.'}
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {relatedNodes.map((related) => (
              <li key={related.nodeId} className="flex flex-col gap-0.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/knowledge/nodes/${related.nodeId}`}
                    className="min-w-0 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {related.relationshipType.replace(/_/g, ' ')} → {related.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <ConfidenceBadge confidence={related.confidence} />
                    <button
                      type="button"
                      disabled={exportLink.isPending}
                      onClick={() => exportLink.mutate(related.nodeId)}
                      className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] disabled:opacity-50"
                    >
                      {/* UX-15.1 — distinguishes this single-relationship
                          Knowledge Link package download from the node's own
                          "Save As…"/"Export Briefing" actions above. */}
                      Export relationship
                    </button>
                  </span>
                </div>
                {/* Knowledge Intelligence Layer v1, Feature 3 — never state a relationship's confidence without also showing what it's based on. */}
                {related.relationshipConfidence.evidenceCount > 0 && (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Backed by {related.relationshipConfidence.evidenceCount} shared source
                    {related.relationshipConfidence.evidenceCount === 1 ? '' : 's'} ({related.relationshipConfidence.sources.join(', ')})
                  </p>
                )}
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
          <SectionHeader title="Knowledge Timeline" description="How this concept has developed, earliest first." />
          <ol className="flex flex-col gap-4">
            {groupEvidenceByPeriod(items).map((period) => (
              <li key={period.key}>
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">{period.label}</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
                  {period.items.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      Mentioned in <span className="text-[var(--color-ink)]">{item.label}</span> — {formatRelativeTime(item.createdAt)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}

      {items.length === 0 && relatedNodes.length === 0 && (
        <EmptyState
          title="No evidence yet"
          description="This concept hasn't been linked to any documents, notes, or conversations yet."
        />
      )}

      <KnowledgeExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        objectLabel="concept"
        request={{
          content: buildKnowledgeNodeExportContent(evidence),
          titleForFilename: node.title,
          buildNovaPackage: async () => ({
            filename: exportFilename(node.title, 'nova'),
            blob: new Blob([JSON.stringify(exportKnowledgeNodePackage(node), null, 2)], { type: 'application/json' }),
          }),
        }}
      />
    </div>
  )
}
