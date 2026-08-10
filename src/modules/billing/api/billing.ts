import { supabase } from '@/shared/lib/supabase'
import type { PesapalCheckoutOrder, Subscription } from '@/shared/types/database'

/**
 * Phase 4 Commercial Architecture — read-only client access to a user's own
 * billing state. RLS on `subscriptions` is own-row SELECT only (see
 * 0047_billing_tables_and_subscription_event_function.sql); all writes go
 * through `apply_subscription_event`, called exclusively from the billing
 * webhook Edge Function with the service-role key. This module never
 * attempts to write subscription state — there is no client-reachable path
 * to do so, by design.
 *
 * A user can have historical rows from a prior/cancelled provider
 * subscription, so this returns the most recently updated row rather than
 * assuming exactly one exists. `null` means "never had a paid
 * subscription" (a Free or admin-assigned-plan user), which is a normal,
 * expected state — not an error.
 */
export async function getCurrentUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getCurrentUserSubscription: query failed:', error)
    return null
  }

  return data
}

/**
 * Phase 5B Pesapal Sandbox Billing — initiates a Pro checkout entirely
 * server-side (pesapal-checkout Edge Function). The client sends only a
 * fixed intent string, never a plan id, price, or currency — every
 * commercial fact is resolved by the server. `supabase.functions.invoke`
 * forwards the caller's own session JWT automatically (same pattern
 * `adminApi.ts`'s `sendBetaInvitationEmail` already uses), so the
 * function can authenticate the caller without this code doing anything
 * extra. Throws on any failure (network, 501 "not configured", a
 * declined order) — callers surface that as an inline error rather than
 * ever assuming success.
 */
export async function startProCheckout(): Promise<{ redirectUrl: string; merchantReference: string }> {
  const { data, error } = await supabase.functions.invoke<{ redirectUrl: string; merchantReference: string }>('pesapal-checkout', {
    body: { intent: 'start_pro_subscription' },
  })
  if (error) throw error
  if (!data) throw new Error('Checkout did not return a redirect URL')
  return data
}

/**
 * Reads the caller's own checkout-order row by merchant reference — RLS
 * is own-row SELECT only (0050_pesapal_sandbox_billing.sql), matching
 * `getCurrentUserSubscription`'s pattern. Powers BillingReturnPage's
 * "payment being confirmed" polling: the row's `status` only ever
 * changes via pesapal-ipn after it independently verifies the outcome
 * with Pesapal, so the UI never has to assume success just because the
 * browser came back from checkout.
 */
export async function getCheckoutOrderByReference(merchantReference: string): Promise<PesapalCheckoutOrder | null> {
  const { data, error } = await supabase.from('pesapal_checkout_orders').select('*').eq('merchant_reference', merchantReference).maybeSingle()
  if (error) {
    console.error('getCheckoutOrderByReference: query failed:', error)
    return null
  }
  return data
}
