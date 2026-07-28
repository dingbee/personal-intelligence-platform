import { Link } from 'react-router-dom'
import { useKnowledgeGraph } from '@/modules/knowledge-graph/hooks/useKnowledgeGraph'
import { GraphCanvas } from '@/modules/knowledge-graph/components/GraphCanvas'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export function KnowledgeGraphPage() {
  const { data, isLoading, isError, error } = useKnowledgeGraph()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/knowledge" className="text-sm text-[var(--color-accent)] hover:underline">
          ← Back to Knowledge
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Knowledge Graph</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          How your documents, notes, highlights, and tags connect. Click a node to open it.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">
          Couldn't load the knowledge graph: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      ) : !data || data.nodes.length === 0 ? (
        <EmptyState
          title="Nothing to graph yet"
          description="Add documents, notes, and highlights — and link a note to a highlight — to see connections here."
        />
      ) : (
        <GraphCanvas data={data} />
      )}
    </div>
  )
}
