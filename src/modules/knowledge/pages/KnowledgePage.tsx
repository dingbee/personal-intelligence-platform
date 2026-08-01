import { Link } from 'react-router-dom'
import { RecentNotesSection } from '@/modules/knowledge/components/RecentNotesSection'
import { RecentHighlightsSection } from '@/modules/knowledge/components/RecentHighlightsSection'
import { RecentSummariesSection } from '@/modules/knowledge/components/RecentSummariesSection'
import { FlashcardActivitySection } from '@/modules/knowledge/components/FlashcardActivitySection'
import { DocumentConnectionsSection } from '@/modules/knowledge/components/DocumentConnectionsSection'
import { KnowledgeInsightsPanel } from '@/modules/knowledge-intelligence/components/KnowledgeInsightsPanel'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

export function KnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        level="page"
        title="Knowledge"
        description="Everything you've accumulated across your notes, highlights, and AI-generated content."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/knowledge/collections"
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] shadow-raised transition-colors hover:bg-[var(--surface-base)]"
            >
              Collections →
            </Link>
            <Link
              to="/knowledge/graph"
              className="rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] shadow-raised transition-colors hover:bg-[var(--surface-base)]"
            >
              View Graph →
            </Link>
          </div>
        }
      />

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
