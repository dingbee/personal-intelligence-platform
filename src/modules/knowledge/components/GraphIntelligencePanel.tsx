import { useMemo, useState } from 'react'
import type { GraphInteractionState } from '@/modules/knowledge/intelligence/graphInteraction'
import type { GraphSuggestion } from '@/modules/knowledge/intelligence/graphSuggestions'
import { explainConnection } from '@/modules/knowledge/intelligence/graphExplorer'
import { useKnowledgeNodes, useKnowledgeEdges, useKnowledgeNodeSources } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { useDocuments } from '@/modules/library/hooks/useDocuments'
import { InsightPanel } from '@/shared/components/knowledge/InsightPanel'
import { ReferenceRow } from '@/modules/intelligence/components/ReferenceRow'
import { SignalList } from '@/modules/intelligence/components/SignalList'
import { PersonalIntelligenceTimeline } from '@/modules/intelligence/components/PersonalIntelligenceTimeline'
import type { CommandActions, CommandContext } from '@/modules/commands/types'

/**
 * UX-10 Phase 9 — the Graph Workspace surfaced on Knowledge Explorer,
 * without redesigning it: everything below reuses existing primitives
 * (InsightPanel, ReferenceRow, SignalList) and the existing card grid stays
 * untouched. The Relationship Explorer is self-contained (fetches its own
 * node/edge/document/source data via already-existing hooks) so
 * GraphInteractionState itself stays exactly the composition the brief
 * specifies — clusters/insights/signals/suggestions/relationships/references.
 */
export function GraphIntelligencePanel({
  state,
  workspaceId,
  onLocalSuggestion,
  commandContext,
  commandActions,
}: {
  state: GraphInteractionState
  workspaceId: string | null
  /** 'open-timeline' is handled locally (expands the embedded timeline below) — only 'explore-cluster'/'expand-topic' bubble up, since those affect the card grid / interactive graph the page owns. */
  onLocalSuggestion: (suggestion: Extract<GraphSuggestion, { kind: 'local' }>) => void
  commandContext: CommandContext
  commandActions: CommandActions
}) {
  const [timelineOpen, setTimelineOpen] = useState(false)
  const isEmpty = state.clusters.length === 0 && state.insights.length === 0 && state.signals.length === 0

  return (
    <InsightPanel
      title="Graph Intelligence"
      description="Insights, clusters, and connections discovered across your knowledge graph."
      isLoading={false}
      isEmpty={isEmpty}
      emptyMessage="Extract knowledge from a few documents to see graph insights here."
    >
      <div className="flex flex-col gap-4">
        {state.insights.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink)]">
            {state.insights.map((insight) => (
              <li key={insight.type}>
                <span className="font-medium">{insight.label}:</span> {insight.value}
              </li>
            ))}
          </ul>
        )}

        {state.clusters.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-muted)]">Clusters</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {state.clusters.map((cluster) => (
                <li
                  key={cluster.id}
                  className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 text-xs text-[var(--color-ink)]"
                >
                  {cluster.label} · {cluster.size}
                </li>
              ))}
            </ul>
          </div>
        )}

        <SignalList signals={state.signals} />

        {state.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.suggestions.map((suggestion) => (
              <button
                key={suggestion.kind === 'local' ? suggestion.id : suggestion.command.id}
                type="button"
                onClick={() => {
                  if (suggestion.kind === 'command') {
                    void suggestion.command.execute(commandContext, commandActions)
                  } else if (suggestion.id === 'open-timeline') {
                    setTimelineOpen(true)
                  } else {
                    onLocalSuggestion(suggestion)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <ReferenceRow references={state.references} />

        <RelationshipExplorer />

        <details open={timelineOpen} onToggle={(e) => setTimelineOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer select-none text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            Knowledge timeline
          </summary>
          <div className="mt-2">
            <PersonalIntelligenceTimeline workspaceId={workspaceId} />
          </div>
        </details>
      </div>
    </InsightPanel>
  )
}

function RelationshipExplorer() {
  const nodesQuery = useKnowledgeNodes()
  const edgesQuery = useKnowledgeEdges()
  const documentsQuery = useDocuments({})
  const nodes = nodesQuery.data ?? []
  const nodeIds = useMemo(() => (nodesQuery.data ?? []).map((n) => n.id), [nodesQuery.data])
  const sourcesQuery = useKnowledgeNodeSources(nodeIds)

  const [nodeAId, setNodeAId] = useState('')
  const [nodeBId, setNodeBId] = useState('')

  if (nodes.length < 2) return null

  const explanation =
    nodeAId && nodeBId && nodeAId !== nodeBId
      ? (() => {
          const nodeA = nodes.find((n) => n.id === nodeAId)
          const nodeB = nodes.find((n) => n.id === nodeBId)
          if (!nodeA || !nodeB) return null
          const documents = (documentsQuery.data ?? []).map((d) => ({ id: d.id, title: d.title, workspace_id: d.workspace_id }))
          return explainConnection(nodeA, nodeB, edgesQuery.data ?? [], sourcesQuery.data ?? [], documents)
        })()
      : null

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
      <p className="text-xs font-medium text-[var(--color-ink-muted)]">Why are these connected?</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={nodeAId}
          onChange={(e) => setNodeAId(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--color-ink)]"
        >
          <option value="">Select a concept…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--color-ink-muted)]">and</span>
        <select
          value={nodeBId}
          onChange={(e) => setNodeBId(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--color-ink)]"
        >
          <option value="">Select a concept…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>
      {explanation && <p className="text-xs text-[var(--color-ink)]">{explanation.explanation}</p>}
    </div>
  )
}
