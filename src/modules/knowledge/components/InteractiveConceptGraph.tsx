import { useMemo, useState } from 'react'
import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { GraphCanvas } from '@/modules/knowledge-graph/components/GraphCanvas'
import {
  collapseNode,
  computeVisibleNodeIds,
  createGraphViewState,
  expandNode,
  findShortestPath,
  focusNode,
  getNeighborhood,
  toGraphData,
  togglePin,
} from '@/modules/knowledge/intelligence/graphNavigator'
import { buildSourceGraphAdditions, mergeGraphLayers } from '@/modules/knowledge/intelligence/graphSourceNodes'
import { useConceptSourceNodes } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'

/**
 * UX-10 Phase 10 — the interactive layer over the AI concept graph. Reuses
 * GraphCanvas's existing SVG rendering (via the toGraphData adapter) and
 * graphNavigator's pure state transitions; this component owns only the
 * local view state (focus/expanded/pinned/shortest-path selection), never
 * refetches or recomputes the graph itself.
 */
export function InteractiveConceptGraph({ nodes, edges }: { nodes: KnowledgeNode[]; edges: KnowledgeLink[] }) {
  const [viewState, setViewState] = useState(createGraphViewState())
  const [pathFromId, setPathFromId] = useState('')
  const [pathToId, setPathToId] = useState('')
  const [showSources, setShowSources] = useState(false)

  const highlightedNodeIds = useMemo(
    () => (viewState.focusedNodeId ? getNeighborhood(viewState.focusedNodeId, edges, 1) : new Set<string>()),
    [viewState.focusedNodeId, edges],
  )
  const visibleNodeIds = useMemo(() => computeVisibleNodeIds(viewState, nodes, edges), [viewState, nodes, edges])
  const conceptGraphData = useMemo(() => toGraphData(nodes, edges, visibleNodeIds), [nodes, edges, visibleNodeIds])

  // Feature 1 — "Show sources" adds one more layer (documents/notes/assets/
  // conversations each concept's evidence points to) onto the same concept
  // graph, without touching graphNavigator's BFS (focus/expand/pin/shortest
  // path stay scoped to concept↔concept edges, unchanged).
  const visibleConceptIds = useMemo(() => Array.from(visibleNodeIds), [visibleNodeIds])
  const conceptSourceNodes = useConceptSourceNodes(visibleConceptIds, showSources)
  const graphData = useMemo(() => {
    if (!showSources || !conceptSourceNodes.data) return conceptGraphData
    return mergeGraphLayers(conceptGraphData, buildSourceGraphAdditions(conceptSourceNodes.data))
  }, [showSources, conceptGraphData, conceptSourceNodes.data])

  const focusedNode = nodes.find((n) => n.id === viewState.focusedNodeId) ?? null
  const shortestPath = pathFromId && pathToId && pathFromId !== pathToId ? findShortestPath(pathFromId, pathToId, edges) : null
  const titleById = new Map(nodes.map((n) => [n.id, n.title]))

  if (nodes.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
        <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} />
        Show sources (documents, notes, images, conversations)
      </label>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {focusedNode ? (
          <>
            <span className="text-[var(--color-ink-muted)]">
              Focused: <span className="font-medium text-[var(--color-ink)]">{focusedNode.title}</span>
            </span>
            <button type="button" onClick={() => setViewState(expandNode(viewState, focusedNode.id))} className="text-[var(--color-accent)] hover:underline">
              Expand neighbors
            </button>
            <button type="button" onClick={() => setViewState(collapseNode(viewState, focusedNode.id))} className="text-[var(--color-accent)] hover:underline">
              Collapse neighbors
            </button>
            <button type="button" onClick={() => setViewState(togglePin(viewState, focusedNode.id))} className="text-[var(--color-accent)] hover:underline">
              {viewState.pinnedNodeIds.has(focusedNode.id) ? 'Unpin' : 'Pin'}
            </button>
            <button type="button" onClick={() => setViewState(focusNode(viewState, null))} className="text-[var(--color-ink-muted)] hover:underline">
              Clear focus
            </button>
          </>
        ) : (
          <span className="text-[var(--color-ink-muted)]">Click a concept to focus it.</span>
        )}
      </div>

      <GraphCanvas
        data={graphData}
        label="AI Knowledge Graph"
        interactive={{
          focusedNodeId: viewState.focusedNodeId,
          highlightedNodeIds,
          pinnedNodeIds: viewState.pinnedNodeIds,
          onNodeClick: (nodeId) => setViewState(focusNode(viewState, viewState.focusedNodeId === nodeId ? null : nodeId)),
        }}
      />

      {nodes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3 text-xs">
          <span className="text-[var(--color-ink-muted)]">Shortest path from</span>
          <select value={pathFromId} onChange={(e) => setPathFromId(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--surface-raised)] px-2 py-1">
            <option value="">Select…</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          <span className="text-[var(--color-ink-muted)]">to</span>
          <select value={pathToId} onChange={(e) => setPathToId(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--surface-raised)] px-2 py-1">
            <option value="">Select…</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
          {pathFromId && pathToId && pathFromId !== pathToId && (
            <span className="text-[var(--color-ink)]">
              {shortestPath ? shortestPath.map((id) => titleById.get(id) ?? id).join(' → ') : 'No path found'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
