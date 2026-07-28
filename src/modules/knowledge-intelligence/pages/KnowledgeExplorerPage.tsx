import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { KnowledgeNodeType } from '@/shared/types/database'
import {
  useKnowledgeInsights,
  useReconcileKnowledgeGraph,
} from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { useKnowledgeNodeDetails } from '@/modules/knowledge-intelligence/hooks/useKnowledgeNodeDetails'
import { KnowledgeCard } from '@/shared/components/knowledge/KnowledgeCard'
import { ConfidenceBadge } from '@/shared/components/knowledge/ConfidenceBadge'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'
import { InsightPanel } from '@/shared/components/knowledge/InsightPanel'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

type TypeFilter = 'all' | KnowledgeNodeType

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'concept', label: 'Concepts' },
  { value: 'entity', label: 'Entities' },
]

function formatProvenance(meta: Record<string, unknown>): string | null {
  const capability = typeof meta.capability === 'string' ? meta.capability : null
  const model = typeof meta.model === 'string' ? meta.model : null
  const generatedAt = typeof meta.generated_at === 'string' ? meta.generated_at : null

  const source = [capability, model].filter(Boolean).join(' · ')
  const when = generatedAt ? new Date(generatedAt).toLocaleDateString() : null
  const parts = [source, when].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : null
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-[var(--color-ink)]">{value}</span>
      <span className="text-xs text-[var(--color-ink-muted)]">{label}</span>
    </div>
  )
}

/** A structured, searchable list of knowledge nodes — the pre-graph-visualization view called for in Phase 7B. */
export function KnowledgeExplorerPage() {
  const [searchParams] = useSearchParams()
  const documentIdFilter = searchParams.get('documentId') ?? undefined

  const { details, isLoading } = useKnowledgeNodeDetails(documentIdFilter)
  const insights = useKnowledgeInsights()
  const reconcile = useReconcileKnowledgeGraph()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return details.filter(({ node }) => {
      if (typeFilter !== 'all' && node.node_type !== typeFilter) return false
      if (q && !node.title.toLowerCase().includes(q) && !(node.description ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [details, query, typeFilter])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Knowledge Explorer</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Every concept and entity your AI has extracted, how it connects, and where it came from.
        </p>
      </div>

      <InsightPanel
        title="Knowledge Intelligence"
        actions={
          <Button variant="secondary" loading={reconcile.isPending} onClick={() => reconcile.mutate()}>
            {reconcile.isPending ? 'Finding connections…' : 'Reconcile knowledge graph'}
          </Button>
        }
        isLoading={insights.isLoading}
        isEmpty={!insights.data || (insights.data.conceptCount === 0 && insights.data.entityCount === 0)}
        emptyMessage="No knowledge extracted yet — open a document and run Analyze Document to get started."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Concepts" value={insights.data?.conceptCount ?? 0} />
          <Stat label="Entities" value={insights.data?.entityCount ?? 0} />
          <Stat label="Relationships" value={insights.data?.edgeCount ?? 0} />
          <Stat label="Documents" value={insights.data?.documentsWithKnowledge ?? 0} />
        </div>
        {reconcile.isError && (
          <p className="text-sm text-red-600">
            {reconcile.error instanceof Error ? reconcile.error.message : 'Failed to reconcile the knowledge graph.'}
          </p>
        )}
        {reconcile.isSuccess && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            {reconcile.data.edgesCreated} new relationship{reconcile.data.edgesCreated === 1 ? '' : 's'} discovered
          </p>
        )}
      </InsightPanel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-sm flex-1">
          <Input
            label="Search"
            placeholder="Search concepts and entities…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === filter.value
                  ? 'bg-[var(--color-ink)] text-white'
                  : 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No knowledge to explore yet"
          description="Open a document and run Analyze Document to populate this view."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ node, sources, connections }) => {
            const provenance = node.generation_metadata ? formatProvenance(node.generation_metadata) : null
            return (
              <KnowledgeCard
                key={node.id}
                title={node.title}
                typeLabel={node.node_type === 'concept' ? 'Concept' : 'Entity'}
                description={node.description}
              >
                {connections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[var(--color-ink-muted)]">Connections</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {connections.map((connection) => (
                        <li
                          key={connection.nodeId}
                          className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink)]"
                        >
                          <span className="truncate">
                            {connection.relationshipType.replace(/_/g, ' ')} → {connection.title}
                          </span>
                          <ConfidenceBadge confidence={connection.confidence} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <SourceReference sources={sources} />
                {provenance && <p className="text-[11px] text-[var(--color-ink-muted)]">Extracted {provenance}</p>}
              </KnowledgeCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
