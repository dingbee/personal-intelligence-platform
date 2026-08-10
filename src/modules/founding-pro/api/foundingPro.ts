import { supabase } from '@/shared/lib/supabase'
import type { FoundingProApplication, FoundingProMember } from '@/shared/types/database'

export interface FoundingProPublicCapacity {
  maxPublicSlots: number
  enrolledPublicCount: number
  remainingPublicSlots: number
}

/**
 * Founding Pro Programme Phase 2 — the one public read path for capacity,
 * safe to call whether or not a visitor is signed in (get_founding_pro_-
 * public_capacity is granted to anon and authenticated alike, and
 * structurally cannot return identity or price — see 0052's own comment).
 */
export async function getFoundingProPublicCapacity(): Promise<FoundingProPublicCapacity | null> {
  const { data, error } = await supabase.rpc('get_founding_pro_public_capacity')
  if (error) {
    console.error('getFoundingProPublicCapacity: query failed:', error)
    return null
  }
  const row = data?.[0]
  if (!row) return null
  return {
    maxPublicSlots: row.max_public_slots,
    enrolledPublicCount: row.enrolled_public_count,
    remainingPublicSlots: row.remaining_public_slots,
  }
}

/**
 * Reads the caller's own Founding Pro membership row, if any. RLS on
 * founding_pro_members is own-row SELECT only (0052), so `.eq('user_id', ...)`
 * here is redundant with the policy, matching the same defensive style
 * `getCurrentUserSubscription` already uses. `null` means "not a Founding
 * Pro member" — a normal state, not an error.
 */
export async function getMyFoundingProMembership(userId: string): Promise<FoundingProMember | null> {
  const { data, error } = await supabase.from('founding_pro_members').select('*').eq('user_id', userId).maybeSingle()
  if (error) {
    console.error('getMyFoundingProMembership: query failed:', error)
    return null
  }
  return data
}

/**
 * Reads the caller's own most recent application row, if any (a user can
 * have historical rejected/withdrawn rows alongside a fresh one — only
 * the most recent matters for display). RLS is own-row SELECT only.
 */
export async function getMyLatestFoundingProApplication(userId: string): Promise<FoundingProApplication | null> {
  const { data, error } = await supabase
    .from('founding_pro_applications')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('getMyLatestFoundingProApplication: query failed:', error)
    return null
  }
  return data
}

/**
 * Submits a Founding Pro application via submit_founding_pro_application
 * (SECURITY DEFINER, 0053_founding_pro_application_submission.sql). Takes
 * no arguments client-side — the function derives user_id from auth.uid()
 * and hardcodes status to 'pending' itself, so there is nothing here for
 * a caller to manipulate. Throws on failure (e.g. an active application
 * already exists, or the user is already enrolled) so the UI can surface
 * the server's own message rather than assuming success.
 */
export async function submitFoundingProApplication(): Promise<{ applicationId: string; status: string }> {
  const { data, error } = await supabase.rpc('submit_founding_pro_application')
  if (error) throw error
  if (!data) throw new Error('Application submission did not return a result')
  const applicationId = data.application_id
  const status = data.status
  if (typeof applicationId !== 'string' || typeof status !== 'string') {
    throw new Error('Application submission returned an unexpected result')
  }
  return { applicationId, status }
}
