import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/ui/Button'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

/**
 * ARRIYIA Product Completion Phase 2 — the Hub's first-run narrative for a
 * genuinely zero-data workspace (see computeIsZeroData in hubData.ts: no
 * documents, notes, or conversations at all). Replaces the full 8-zone
 * dashboard entirely rather than sitting above a page full of otherwise-
 * empty sections — the audit's own finding was that a new user "receives
 * substantially the same experience as an established user," and adding
 * one more banner on top of that dashboard wouldn't have fixed it.
 *
 * Deliberately not a tutorial: one short orientation paragraph, one
 * primary CTA into the single most useful first action (adding a
 * document — everything else in ARRIYIA, from chat retrieval to the
 * knowledge graph, is grounded in what's actually in the library), and a
 * couple of secondary paths into other real, already-working destinations.
 * No new routes, dialogs, or state — every link below is one that already
 * exists and works today.
 */
export function HubOnboarding({ workspaceName }: { workspaceName: string }) {
  const navigate = useNavigate()

  return (
    <SurfaceCard className="flex flex-col items-center gap-5 py-14 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">Welcome to {workspaceName}</h2>
        <p className="max-w-lg text-sm text-[var(--color-ink-muted)]">
          ARRIYIA helps you think through problems, organize what you know, work directly with your documents, remember
          what matters, and turn all of it into useful outputs — grounded in what you actually add here, not a generic
          AI with no context on you.
        </p>
      </div>

      <Button onClick={() => navigate('/library')}>Add your first document</Button>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <Link to="/chat" className="text-[var(--color-accent)] hover:underline">
          Start a conversation
        </Link>
        <Link to="/settings" className="text-[var(--color-accent)] hover:underline">
          Complete your profile
        </Link>
      </div>
    </SurfaceCard>
  )
}
