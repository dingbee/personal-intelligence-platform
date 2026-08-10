import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useMyFoundingProMembership, useMyPendingFoundingProInvitation } from '@/modules/founding-pro/hooks/useMyFoundingProStatus'
import { useAcceptFoundingProInvitation } from '@/modules/founding-pro/hooks/useAcceptFoundingProInvitation'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

function formatPrice(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency })
}

const FOUNDING_PRO_BENEFITS = [
  'Full Pro functionality, active immediately',
  'Locked in at your founding rate for your 3-month founding period',
  'Automatic transition to standard Pro once your founding period ends',
]

/**
 * Founding Pro Programme Phase 4 — the protected acceptance page. This
 * route only ever renders inside the ProtectedRoute-wrapped AppShell
 * subtree (see router.tsx), so authentication is already guaranteed —
 * "require authentication" is enforced before this component ever
 * mounts, the same way FoundingProApplyPage already relies on.
 *
 * Acceptance itself calls accept_founding_pro_invitation() with no
 * arguments — every check (does this invitation belong to me, is it
 * still pending, is the application still approved, is there capacity)
 * happens server-side inside that RPC and the atomic enrollment core it
 * delegates to (0055). This page never supplies or displays an
 * invitation id, price it could edit, or a membership number it could
 * invent — the price shown below is read-only, straight from the
 * invitation row the admin already fixed.
 */
export function FoundingProInvitationPage() {
  const { user } = useAuth()
  const { data: invitation, isLoading: invitationLoading } = useMyPendingFoundingProInvitation()
  const { data: membership, isLoading: membershipLoading } = useMyFoundingProMembership()
  const acceptMutation = useAcceptFoundingProInvitation()
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const isLoading = invitationLoading || membershipLoading

  async function handleAccept() {
    setAcceptError(null)
    try {
      await acceptMutation.mutateAsync()
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Could not accept your invitation. Please try again.')
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/pricing" className="text-sm text-[var(--color-accent)] hover:underline">
          ← Back to plans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">Founding Pro Invitation</h1>
      </div>

      <SurfaceCard className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : acceptMutation.isSuccess ? (
          <>
            <p className="text-sm text-[var(--color-ink)]">
              You're now a Founding Pro member
              {membership?.founding_member_number ? ` — Founding Member #${membership.founding_member_number}` : ''}. Full
              Pro functionality is active on your account.
            </p>
            <Link to="/hub">
              <Button className="w-full">Go to ARRIYIA</Button>
            </Link>
          </>
        ) : membership ? (
          <p className="text-sm text-[var(--color-ink)]">
            You're already a Founding Pro member
            {membership.founding_member_number ? ` — Founding Member #${membership.founding_member_number}` : ''}.
          </p>
        ) : !invitation ? (
          <p className="text-sm text-[var(--color-ink)]">
            No active Founding Pro invitation was found for {user?.email ?? 'your account'}. If you believe this is a
            mistake, check the invitation email for the correct account.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Your Founding Pro application has been approved. Accepting below activates your membership immediately at
              your founding rate.
            </p>
            <div className="rounded-control bg-[var(--surface-inset)] px-3 py-2">
              <p className="text-lg font-semibold text-[var(--color-ink)]">
                {formatPrice(invitation.founding_price_cents, invitation.currency)}
                <span className="ml-1 text-sm font-normal text-[var(--color-ink-muted)]">for your 3-month founding period</span>
              </p>
            </div>
            <ul className="flex flex-col gap-2 text-sm text-[var(--color-ink)]">
              {FOUNDING_PRO_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Button onClick={handleAccept} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? 'Activating…' : 'Accept and activate Founding Pro'}
            </Button>
            {acceptError && <p className="text-xs text-[var(--color-danger-strong)]">{acceptError}</p>}
          </>
        )}
      </SurfaceCard>
    </div>
  )
}
