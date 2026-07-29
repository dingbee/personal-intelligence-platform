import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GraphEdge, GraphNode, GraphNodeType, KnowledgeGraphData } from '@/modules/knowledge-graph/api/types'

const ROW_ORDER: GraphNodeType[] = ['document', 'note', 'highlight', 'tag', 'concept', 'entity']

const NODE_STYLE: Record<GraphNodeType, { fill: string; label: string }> = {
  document: { fill: '#4f46e5', label: 'Document' },
  note: { fill: '#059669', label: 'Note' },
  highlight: { fill: '#d97706', label: 'Highlight' },
  tag: { fill: '#e11d48', label: 'Tag' },
  concept: { fill: '#7c3aed', label: 'Concept' },
  entity: { fill: '#0891b2', label: 'Entity' },
}

const ROW_HEIGHT = 140
const NODE_RADIUS = 10
const MIN_NODE_SPACING = 90
const PADDING_X = 80
const PADDING_Y = 60

interface PositionedNode extends GraphNode {
  x: number
  y: number
}

/** Only rows with at least one node are laid out/shown — avoids empty rows and dead legend entries when a graph doesn't use every node type (true before UX-10 too: a workspace with no notes never needed a "Note" row, this just makes that consistent everywhere). */
function layoutNodes(nodes: GraphNode[]): { positioned: PositionedNode[]; width: number; height: number; activeRowOrder: GraphNodeType[] } {
  const byType = new Map<GraphNodeType, GraphNode[]>()
  for (const type of ROW_ORDER) byType.set(type, [])
  for (const node of nodes) byType.get(node.type)?.push(node)
  const activeRowOrder = ROW_ORDER.filter((type) => byType.get(type)!.length > 0)

  const maxRowCount = Math.max(1, ...activeRowOrder.map((type) => byType.get(type)!.length))
  const width = Math.max(600, PADDING_X * 2 + (maxRowCount - 1) * MIN_NODE_SPACING)
  const height = PADDING_Y * 2 + Math.max(0, activeRowOrder.length - 1) * ROW_HEIGHT

  const positioned: PositionedNode[] = []
  activeRowOrder.forEach((type, rowIndex) => {
    const rowNodes = byType.get(type)!
    const y = PADDING_Y + rowIndex * ROW_HEIGHT
    const count = rowNodes.length
    rowNodes.forEach((node, i) => {
      const x = count === 1 ? width / 2 : PADDING_X + (i * (width - PADDING_X * 2)) / (count - 1)
      positioned.push({ ...node, x, y })
    })
  })

  return { positioned, width, height, activeRowOrder }
}

function navigateTargetFor(node: GraphNode): string | null {
  switch (node.type) {
    case 'document':
      return `/library/${node.id}`
    case 'note':
      return `/notes/${node.id}`
    case 'highlight':
      return node.documentId ? `/library/${node.documentId}/read` : null
    case 'tag':
    case 'concept':
    case 'entity':
      return null
  }
}

/**
 * UX-10 Phase 10 — optional interactivity layered on the existing renderer.
 * Omitted entirely, this component behaves exactly as it did before this
 * phase (click-to-navigate only). When provided, node clicks report to
 * `onNodeClick` instead of navigating, and focused/highlighted/pinned nodes
 * get a visual treatment — still the same SVG, no new graph library.
 */
export interface GraphInteractivity {
  focusedNodeId: string | null
  highlightedNodeIds: Set<string>
  pinnedNodeIds: Set<string>
  onNodeClick: (nodeId: string) => void
}

interface GraphCanvasProps {
  data: KnowledgeGraphData
  interactive?: GraphInteractivity
}

export function GraphCanvas({ data, interactive }: GraphCanvasProps) {
  const navigate = useNavigate()
  const { positioned, width, height, activeRowOrder } = useMemo(() => layoutNodes(data.nodes), [data.nodes])
  const nodesById = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned])

  const positionedEdges = useMemo(
    () =>
      data.edges
        .map((edge) => ({ edge, source: nodesById.get(edge.sourceId), target: nodesById.get(edge.targetId) }))
        .filter((e): e is { edge: GraphEdge; source: PositionedNode; target: PositionedNode } => Boolean(e.source && e.target)),
    [data.edges, nodesById],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-ink-muted)]">
        {activeRowOrder.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NODE_STYLE[type].fill }} />
            {NODE_STYLE[type].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <svg width={width} height={height} role="img" aria-label="Knowledge graph">
          <g>
            {positionedEdges.map(({ edge, source, target }) => (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="var(--color-border)"
                strokeWidth={1.5}
              />
            ))}
          </g>
          <g>
            {positioned.map((node) => {
              const target = navigateTargetFor(node)
              const isFocused = interactive?.focusedNodeId === node.id
              const isHighlighted = interactive?.highlightedNodeIds.has(node.id) ?? false
              const isPinned = interactive?.pinnedNodeIds.has(node.id) ?? false
              const onClick = interactive
                ? () => interactive.onNodeClick(node.id)
                : target
                  ? () => navigate(target)
                  : undefined
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={onClick}
                  style={{ cursor: onClick ? 'pointer' : 'default' }}
                >
                  {isPinned && <circle r={NODE_RADIUS + 5} fill="none" stroke="var(--color-accent)" strokeDasharray="2 2" />}
                  <circle
                    r={NODE_RADIUS}
                    fill={NODE_STYLE[node.type].fill}
                    stroke={isFocused ? 'var(--color-ink)' : isHighlighted ? 'var(--color-accent)' : 'none'}
                    strokeWidth={isFocused ? 3 : isHighlighted ? 2 : 0}
                  />
                  <text
                    y={NODE_RADIUS + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--color-ink)"
                  >
                    {node.label.length > 14 ? `${node.label.slice(0, 13)}…` : node.label}
                  </text>
                  <title>{node.label}</title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
