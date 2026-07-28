import { Link } from 'react-router-dom'
import { RecentNotesSection } from '@/modules/knowledge/components/RecentNotesSection'
import { RecentHighlightsSection } from '@/modules/knowledge/components/RecentHighlightsSection'
import { RecentSummariesSection } from '@/modules/knowledge/components/RecentSummariesSection'
import { FlashcardActivitySection } from '@/modules/knowledge/components/FlashcardActivitySection'
import { DocumentConnectionsSection } from '@/modules/knowledge/components/DocumentConnectionsSection'
import { KnowledgeInsightsPanel } from '@/modules/knowledge-intelligence/components/KnowledgeInsightsPanel'

export function KnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Knowledge</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Everything you've accumulated across your notes, highlights, and AI-generated content.
          </p>
        </div>
        <Link
          to="/knowledge/graph"
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
        >
          View Graph →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentNotesSection />
        <RecentHighlightsSection />
        <RecentSummariesSection />
        <FlashcardActivitySection />
        <div className="lg:col-span-2">
          <DocumentConnectionsSection />
        </div>
      </div>

      <KnowledgeInsightsPanel />
    </div>
  )
}
