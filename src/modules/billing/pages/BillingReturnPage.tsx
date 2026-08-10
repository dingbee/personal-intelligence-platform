import { Link, useSearchParams } from 'react-router-dom'
import { useCheckoutOrderStatus } from '@/modules/billing/hooks/useCheckoutOrderStatus'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'

/**
 * Phase 5B Pesapal Sandbox Billing — where Pesapal's callback_url sends
 * the browser back after checkout. This page never assumes payment
 * success just because the user returned here: it polls the caller's own
 * pesapal_checkout_orders row (useCheckoutOrderStatus), which only
 * changes once pesapal-ipn has independently verified the outcome with
 * Pesapal via GetTransactionStatus. The database is the authoritative
 * source of truth throughout — this page is a read-only view of it.
 *
 * merchantReference travels back from pesapal-checkout's own response
 * (query param OrderMerchantReference, which Pesapal's callback also
 * carries) — matches Pesapal's own documented callback shape.
 */
export function BillingReturnPage() {
  const [searchParams] = useSearchParams()
  const merchantReference = searchParams.get('OrderMerchantReference') ?? searchParams.get('merchantReference')
  const { data: order, isLoading } = useCheckoutOrderStatus(merchantReference)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <SurfaceCard className="flex flex-col items-center gap-4 py-10 text-center">
        {!merchantReference ? (
          <>
            <h1 className="text-lg font-semibold text-[var(--color-ink)]">No checkout reference found</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">We couldn't find a checkout to confirm. If you completed a payment, check your billing status in Settings shortly.</p>
          </>
        ) : isLoading || !order || order.status === 'pending' ? (
          <>
            <div aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
            <h1 className="text-lg font-semibold text-[var(--color-ink)]">Confirming your payment…</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">
              This can take a minute while we verify your transaction with Pesapal. This page updates automatically — no need to refresh.
            </p>
          </>
        ) : order.status === 'completed' ? (
          <>
            <h1 className="text-lg font-semibold text-[var(--color-ink)]">Payment confirmed</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">Your Pro access is now active.</p>
            <Link to="/settings">
              <Button>Go to Settings</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-[var(--color-ink)]">Payment didn't go through</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">Your card or payment method wasn't charged, and nothing on your account changed. You can try again.</p>
            <Link to="/pricing">
              <Button>Back to Plans</Button>
            </Link>
          </>
        )}
      </SurfaceCard>
    </div>
  )
}
