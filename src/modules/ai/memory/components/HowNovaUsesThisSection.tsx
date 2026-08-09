import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'

const REASONS: { title: string; description: string }[] = [
  {
    title: 'Better recommendations',
    description: 'Your goals and expertise steer suggestions toward what actually helps you, instead of generic advice.',
  },
  {
    title: 'Better writing style',
    description: 'Communication style and preferred answer length shape tone and length so responses feel like they were written for you.',
  },
  {
    title: 'Industry terminology',
    description: "Your industry lets ARRIYIA use the vocabulary you'd expect instead of over-explaining basics.",
  },
  {
    title: 'Remembering ongoing projects',
    description: "Facts ARRIYIA picks up from your conversations carry forward, so you don't have to re-explain what you're working on.",
  },
  {
    title: 'Preferred response format',
    description: 'Decision style and answer length tell ARRIYIA whether to lay out options and tradeoffs or give a direct recommendation.',
  },
]

/**
 * UX-13.6 Phase 2 — every reason listed here maps to a real field or
 * memory type already read by retrieveMemoryContext/formatMemoriesForPrompt
 * (see profileFields.ts and MemoryTogglesSection): nothing described here
 * is aspirational or a control that doesn't exist.
 */
export function HowNovaUsesThisSection() {
  return (
    <SurfaceCard className="flex flex-col gap-3">
      <SectionHeader level="section" title="How ARRIYIA uses this information" description="Why it's worth filling in." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <div key={reason.title} className="rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3">
            <p className="text-sm font-medium text-[var(--color-ink)]">{reason.title}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{reason.description}</p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}
