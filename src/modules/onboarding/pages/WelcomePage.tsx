import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useProfile } from '@/modules/settings/hooks/useProfile'
import { appConfig } from '@/app/appConfig'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'

/**
 * First-Login Welcome Experience — shown exactly once, gated by
 * `profile.onboarding_completed_at` (see AppShell.tsx's redirect and
 * 0079_onboarding_state.sql). Deliberately a single page, not a multi-step
 * wizard framework: the "guided orientation" and "progress" requirements
 * are both satisfied as static content on this one scrollable page rather
 * than as separate routes/steps a user could get stuck on — there is
 * nothing to "get stuck in" here by construction.
 *
 * Every primary action both marks onboarding complete AND navigates
 * straight into the real, existing flow it names (upload, chat, workspace,
 * Drive import) — never a fake/demo destination. "Skip" does the same
 * completion write without navigating anywhere but the app's own home.
 */

const ORIENTATION_STEPS = [
  {
    title: 'Your Library',
    body: 'Upload documents, notes, and files. ARRIYIA reads them so you can ask questions grounded in your own material.',
  },
  {
    title: 'Conversations',
    body: 'Talk with ARRIYIA about anything in your library — or simply think out loud.',
  },
  {
    title: 'Intelligence',
    body: 'Research, analyse, plan, and decide — the intelligence tools available to you depend on your plan.',
  },
  {
    title: 'Workspaces',
    body: 'Group related knowledge into a workspace, and invite collaborators if your plan supports it.',
  },
]

const PROGRESS_STAGES = ['Get started', 'Add knowledge', 'Start working']

export function WelcomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { completeOnboarding } = useProfile()

  function finish(to: string) {
    completeOnboarding.mutate()
    navigate(to)
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--color-canvas)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4 md:px-8">
        <span className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">{appConfig.productName}</span>
        <Button variant="ghost" onClick={() => finish('/')}>
          Skip for now
        </Button>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)] md:text-3xl">
            Welcome to {appConfig.productName}{user?.email ? ',' : '.'}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)] md:text-base">
            {appConfig.productSubtitle} — a place to bring your documents and knowledge, ask questions, analyse
            information, and build context that grows the more you use it.
          </p>
        </div>

        {/* Lightweight progress — informative only, never a gate. */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]" aria-label="Getting started progress">
          {PROGRESS_STAGES.map((stage, i) => (
            <span key={stage} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/15 text-[10px] font-medium text-[var(--color-accent)]">
                  {i + 1}
                </span>
                {stage}
              </span>
              {i < PROGRESS_STAGES.length - 1 && <span aria-hidden>→</span>}
            </span>
          ))}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Start here</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SurfaceCard className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">Upload your first document</p>
              <p className="text-xs text-[var(--color-ink-muted)]">Bring a PDF, Word doc, spreadsheet, or notes into your library.</p>
              <Button className="mt-auto" onClick={() => finish('/library')}>
                Upload a document
              </Button>
            </SurfaceCard>

            <SurfaceCard className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">Start your first conversation</p>
              <p className="text-xs text-[var(--color-ink-muted)]">Ask anything — with or without documents. ARRIYIA can help you think, research, analyse, and work with your knowledge.</p>
              <Button className="mt-auto" onClick={() => finish('/chat')}>
                Start a conversation
              </Button>
            </SurfaceCard>

            <SurfaceCard className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">Create or use a workspace</p>
              <p className="text-xs text-[var(--color-ink-muted)]">Organize your knowledge, and invite collaborators if your plan supports it.</p>
              <Button className="mt-auto" onClick={() => finish('/settings/workspaces')}>
                Go to workspaces
              </Button>
            </SurfaceCard>

            <SurfaceCard className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[var(--color-ink)]">Import from Google Drive</p>
              <p className="text-xs text-[var(--color-ink-muted)]">Bring documents you already have in Google Drive straight into your library.</p>
              <Button variant="secondary" className="mt-auto" onClick={() => finish('/library')}>
                Import from Drive
              </Button>
            </SurfaceCard>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">How it fits together</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ORIENTATION_STEPS.map((step) => (
              <SurfaceCard key={step.title} className="flex flex-col gap-1">
                <p className="text-sm font-medium text-[var(--color-ink)]">{step.title}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">{step.body}</p>
              </SurfaceCard>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => finish('/')}>
            Skip and go to my workspace
          </Button>
        </div>
      </div>
    </div>
  )
}
