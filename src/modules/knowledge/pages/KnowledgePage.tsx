import { RecentNotesSection } from '@/modules/knowledge/components/RecentNotesSection'
import { RecentHighlightsSection } from '@/modules/knowledge/components/RecentHighlightsSection'
import { RecentSummariesSection } from '@/modules/knowledge/components/RecentSummariesSection'
import { FlashcardActivitySection } from '@/modules/knowledge/components/FlashcardActivitySection'
import { DocumentConnectionsSection } from '@/modules/knowledge/components/DocumentConnectionsSection'

export function KnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Knowledge</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Everything you've accumulated across your notes, highlights, and AI-generated content.
        </p>
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

      {/*
        Structural placeholder for future AI-driven sections (suggested
        connections, knowledge gaps, learning insights — see the Phase 4
        architecture audit's roadmap). Deliberately static and un-styled
        beyond matching the section chrome: no capability, prompt, or
        provider work happens here yet, per this phase's scope.
      */}
      <section className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">
          AI-suggested connections and insights arrive in a future milestone.
        </p>
      </section>
    </div>
  )
}
