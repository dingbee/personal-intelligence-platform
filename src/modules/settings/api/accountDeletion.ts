import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'

export interface DeleteAccountResult {
  error: string | null
}

/**
 * P1-3 (Edge Function diagnostic error-swallowing) — mirrors
 * workspaceMembers.ts's own `extractEdgeFunctionErrorMessage` exactly:
 * `supabase.functions.invoke()` throws a `FunctionsHttpError` for any
 * non-2xx response whose `.message` is always the same hardcoded string
 * ("Edge Function returned a non-2xx status code"), regardless of what
 * delete-account actually reported. The real reason lives in the response
 * body, reachable via `.context` — delete-account's own `errorResponse`
 * helper always responds with `{ error: string }` on failure, so this
 * reads exactly that one field. Any read failure (non-JSON body, empty
 * body, unexpected shape) falls back to the original generic
 * `error.message`, so this can only ever add information, never lose the
 * pre-existing behavior.
 */
async function extractEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  const fallbackMessage = error instanceof Error ? error.message : 'Failed to delete account'
  if (!(error instanceof FunctionsHttpError)) return fallbackMessage

  try {
    const body: unknown = await error.context.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const serverMessage = (body as { error: unknown }).error
      if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) return serverMessage
    }
  } catch {
    // Response body wasn't valid JSON (or couldn't be read) — use the generic fallback below.
  }

  return fallbackMessage
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
  return { error: error ? await extractEdgeFunctionErrorMessage(error) : null }
}
