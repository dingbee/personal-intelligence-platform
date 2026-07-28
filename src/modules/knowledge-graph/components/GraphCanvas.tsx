import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GraphEdge, GraphNode, GraphNodeType, KnowledgeGraphData } from '@/modules/knowledge-graph/api/types'

const ROW_ORDER: GraphNodeType[] = ['document', 'note', 'highlight', 'tag']

const NODE_STYLE: Record<GraphNodeType, { fill: string; label: string }> = {
  document: { fill: '#4f46e5', label: 'Document' },
  note: { fill: '#059669', label: 'Note' },
  highlight: { fill: '#d97706', label: 'Highlight' },
  tag: { fill: '#e11d48', label: 'Tag' },
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

function layoutNodes(nodes: GraphNode[]): { positioned: PositionedNode[]; width: number; height: number } {
  const byType = new Map<GraphNodeType, GraphNode[]>()
  for (const type of ROW_ORDER) byType.set(type, [])
  for (const node of nodes) byType.get(node.type)?.push(node)

  const maxRowCount = Math.max(1, ...ROW_ORDER.map((type) => byType.get(type)!.length))
  const width = Math.max(600, PADDING_X * 2 + (maxRowCount - 1) * MIN_NODE_SPACING)
  const height = PADDING_Y * 2 + (ROW_ORDER.length - 1) * ROW_HEIGHT

  const positioned: PositionedNode[] = []
  ROW_ORDER.forEach((type, rowIndex) => {
    const rowNodes = byType.get(type)!
    const y = PADDING_Y + rowIndex * ROW_HEIGHT
    const count = rowNodes.length
    rowNodes.forEach((node, i) => {
      const x = count === 1 ? width / 2 : PADDING_X + (i * (width - PADDING_X * 2)) / (count - 1)
      positioned.push({ ...node, x, y })
    })
  })

  return { positioned, width, height }
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
      return null
  }
}

interface GraphCanvasProps {
  data: KnowledgeGraphData
}

export function GraphCanvas({ data }: GraphCanvasProps) {
  const navigate = useNavigate()
  const { positioned, width, height } = useMemo(() => layoutNodes(data.nodes), [data.nodes])
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
        {ROW_ORDER.map((type) => (
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
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={target ? () => navigate(target) : undefined}
                  style={{ cursor: target ? 'pointer' : 'default' }}
                >
                  <circle r={NODE_RADIUS} fill={NODE_STYLE[node.type].fill} />
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
