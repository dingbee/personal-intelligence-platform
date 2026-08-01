import { Link } from 'react-router-dom'
import { useKnowledgeNodeDetails } from '@/modules/knowledge-intelligence/hooks/useKnowledgeNodeDetails'
import { InsightPanel } from '@/shared/components/knowledge/InsightPanel'
import { KnowledgeCard } from '@/shared/components/knowledge/KnowledgeCard'
import { ConfidenceBadge } from '@/shared/components/knowledge/ConfidenceBadge'
import { SourceReference } from '@/shared/components/knowledge/SourceReference'

const PREVIEW_LIMIT = 6

/** The Knowledge Dashboard's AI-generated section — replaces the Phase 6B static placeholder now that extraction actually produces something to show. */
export function KnowledgeInsightsPanel() {
  const { details, isLoading, isError, refetch } = useKnowledgeNodeDetails()
  const preview = details.slice(0, PREVIEW_LIMIT)

  return (
    <InsightPanel
      title="Knowledge insights"
      description="Concepts and entities your AI has extracted from your documents."
      actions={
        <Link to="/knowledge/explorer" className="text-xs text-[var(--color-accent)] hover:underline">
          Open explorer →
        </Link>
      }
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      errorMessage="Couldn't load knowledge insights — that's a failed request, not an empty workspace."
      isEmpty={preview.length === 0}
      emptyMessage="No knowledge extracted yet — open a document and run Analyze Document to get started."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {preview.map(({ node, sources, connections, confidence }) => (
          <KnowledgeCard
            key={node.id}
            title={node.title}
            typeLabel={node.node_type === 'concept' ? 'Concept' : 'Entity'}
            description={node.description}
            confidence={confidence}
          >
            {connections.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Connected to</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {connections.slice(0, 3).map((connection) => (
                    <li
                      key={connection.nodeId}
                      className="flex items-center justify-between gap-2 text-xs text-[var(--color-ink)]"
                    >
                      <span className="min-w-0 truncate">{connection.title}</span>
                      <ConfidenceBadge confidence={connection.confidence} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SourceReference sources={sources} />
          </KnowledgeCard>
        ))}
      </div>
    </InsightPanel>
  )
}
