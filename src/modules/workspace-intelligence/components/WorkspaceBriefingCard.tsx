import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHasProIntelligence } from '@/modules/plans/hooks/useHasProIntelligence'
import { useGenerateWorkspaceBriefing } from '@/modules/workspace-intelligence/hooks/useGenerateWorkspaceBriefing'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { SectionHeader } from '@/shared/components/ui/layout/SectionHeader'
import { Spinner } from '@/shared/components/ui/Spinner'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

/**
 * Phase P1 Advanced AI Workspace — the first real Pro Intelligence
 * capability's UI. A restrained card on the existing Hub page, not a new
 * page: generates a workspace-wide status briefing on demand and shows
 * the result inline, persisted as a Note the user can revisit from
 * /notes (same pattern as generate-briefing's per-concept output).
 *
 * Free-tier sees a locked state instead of the generate button —
 * useHasProIntelligence is a UX hint only (Phase P0); the real boundary
 * is runCapability's server-side check, so this component never needs
 * to "know" why generation failed for a Free user who somehow triggers
 * it anyway — the mutation's own error message covers that case too.
 */
export function WorkspaceBriefingCard() {
  const { data: hasProIntelligence, isLoading: isCheckingEntitlement } = useHasProIntelligence()
  const generateBriefing = useGenerateWorkspaceBriefing()
  const [briefing, setBriefing] = useState<{ title: string; content: string } | null>(null)

  async function handleGenerate() {
    const note = await generateBriefing.mutateAsync()
    setBriefing({ title: note.title, content: note.content })
  }

  return (
    <SurfaceCard className="flex flex-col gap-3">
      <SectionHeader
        level="section"
        title="Workspace Briefing"
        description="An AI-synthesized status briefing: what this workspace is working on, its objectives, what's established, what's unresolved, and what's next."
        action={
          <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Pro Intelligence
          </span>
        }
      />

      {isCheckingEntitlement ? (
        <Spinner size="sm" />
      ) : !hasProIntelligence ? (
        <div className="flex flex-col gap-2 rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-3 text-sm text-[var(--color-ink-muted)]">
          <p>Workspace Briefing is a Pro Intelligence capability.</p>
          <Link to="/pricing" className="text-[var(--color-accent)] hover:underline">
            Upgrade to Pro →
          </Link>
        </div>
      ) : briefing ? (
        <div className="flex flex-col gap-2">
          <p className="whitespace-pre-wrap text-sm text-[var(--color-ink)]">{briefing.content}</p>
          <div className="flex items-center gap-3">
            <Link to="/notes" className="text-xs text-[var(--color-accent)] hover:underline">
              Saved to Notes →
            </Link>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generateBriefing.isPending}
              className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {generateBriefing.isPending ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generateBriefing.isPending}
            className="self-start rounded-control bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-canvas)] disabled:opacity-50"
          >
            {generateBriefing.isPending ? 'Generating…' : 'Generate Workspace Briefing'}
          </button>
          {generateBriefing.isError && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {errorMessage(generateBriefing.error, 'Failed to generate the briefing. Please try again.')}
            </p>
          )}
        </div>
      )}
    </SurfaceCard>
  )
}
