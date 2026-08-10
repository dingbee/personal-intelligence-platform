import { supabase } from '@/shared/lib/supabase'
import type { Subscription } from '@/shared/types/database'

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
