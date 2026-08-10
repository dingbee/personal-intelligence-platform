import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useFoundingProCapacity } from '@/modules/founding-pro/hooks/useFoundingProCapacity'
import { useMyFoundingProMembership, useMyLatestFoundingProApplication } from '@/modules/founding-pro/hooks/useMyFoundingProStatus'
import { useSubmitFoundingProApplication } from '@/modules/founding-pro/hooks/useSubmitFoundingProApplication'
import { resolveFoundingProDisplayState } from '@/modules/founding-pro/foundingProState'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * Founding Pro Programme Phase 2 — the minimum UI needed to submit an
 * application. This route only ever renders inside the ProtectedRoute-
 * wrapped AppShell subtree (see router.tsx), so authentication is already
 * guaranteed by the time this component mounts — a signed-out visitor
 * never reaches this page at all, matching "Application requires an
 * authenticated user."
 *
 * No form fields: the applicant's identity comes entirely from their
 * existing session (auth.uid() server-side, user.email client-side for
 * display only) — nothing here asks them to re-enter information ARRIYIA
 * already has. Submission calls submit_founding_pro_application(), which
 * takes no arguments and cannot assign a slot, grant entitlement, decide
 * a price, or approve itself — see that RPC's own migration comment.
 */
export function FoundingProApplyPage() {
  const { user } = useAuth()
  const { data: capacity, isLoading: capacityLoading } = useFoundingProCapacity()
  const { data: membership, isLoading: membershipLoading } = useMyFoundingProMembership()
  const { data: latestApplication, isLoading: applicationLoading } = useMyLatestFoundingProApplication()
  const submitMutation = useSubmitFoundingProApplication()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isLoading = capacityLoading || membershipLoading || applicationLoading
  const state = resolveFoundingProDisplayState({
    isAuthenticated: Boolean(user),
    isLoading,
    membership: membership ?? null,
    latestApplication: latestApplication ?? null,
    remainingPublicSlots: capacity?.remainingPublicSlots ?? null,
  })

  async function handleSubmit() {
    setSubmitError(null)
    try {
      await submitMutation.mutateAsync()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your application. Please try again.')
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/pricing" className="text-sm text-[var(--color-accent)] hover:underline">
          ← Back to plans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Apply for Founding Pro</h1>
      </div>

      <SurfaceCard className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : state.kind === 'member' ? (
          <p className="text-sm text-[var(--color-ink)]">You're already a Founding Pro member — no application needed.</p>
        ) : state.kind === 'application-pending' ? (
          <p className="text-sm text-[var(--color-ink)]">
            {state.status === 'approved'
              ? "Your application has been approved. We'll let you know once your Founding Pro membership is activated."
              : "Your application is pending review. We'll let you know as soon as a decision is made."}
          </p>
        ) : state.kind === 'capacity-full' ? (
          <p className="text-sm text-[var(--color-ink)]">All 100 public Founding Pro spots are filled right now. Check back later.</p>
        ) : submitMutation.isSuccess ? (
          <p className="text-sm text-[var(--color-ink)]">
            Your application has been submitted. We'll review it and let you know the outcome at {user?.email}.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              We'll review your application using your ARRIYIA account{user?.email ? ` (${user.email})` : ''} — no additional
              information is needed.
            </p>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
            {submitError && <p className="text-xs text-[var(--color-danger-strong)]">{submitError}</p>}
          </>
        )}
      </SurfaceCard>
    </div>
  )
}
