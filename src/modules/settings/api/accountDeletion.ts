import { supabase } from '@/shared/lib/supabase'

export interface DeleteAccountResult {
  error: string | null
}

/**
 * PIP Sprint 10/10 — invokes the delete-account edge function, mirroring
 * sendBetaInvitationEmail's own shape: `supabase.functions.invoke`
 * forwards the caller's own session JWT automatically, and the function
 * always deletes the CALLING user's own account — no id is ever passed,
 * because there is no "delete another user" path to pass one to. Returns
 * `{ error }` rather than throwing so the caller can render a specific
 * failure message (e.g. "admin accounts can't self-delete") without a
 * try/catch at every call site.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const { error } = await supabase.functions.invoke('delete-account')
  return { error: error ? error.message : null }
}
