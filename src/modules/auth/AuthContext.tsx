import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { AuthContext, type AuthContextValue } from '@/modules/auth/context'

// Phase 5.2 — mirrors the edge functions' existing SITE_URL-with-origin-
// fallback pattern (supabase/functions/send-*-invitation) on the client
// side. window.location.origin alone breaks if the app is ever reachable
// from more than one domain (e.g. a corporate site sharing the same
// deployment) — this pins the reset-password redirect to the canonical
// ARRIYIA origin when VITE_SITE_URL is configured, without hardcoding a
// domain into the logic itself. Read per-call (not hoisted to a module
// constant) so it stays correct if the env value is ever unavailable at
// module-evaluation time.
function canonicalSiteUrl(): string {
  return import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || window.location.origin
}

type SignupDenialReason = 'invitation_expired' | 'invitation_revoked' | 'not_invited'

// V1 — Collaboration Invitation Signup Authorization. Distinct, accurate
// copy per denial reason (Workstream 6) — no wording says "beta" anymore,
// since a workspace invitation is now an equally valid, non-beta basis
// for account creation.
const SIGNUP_DENIAL_MESSAGE: Record<SignupDenialReason, string> = {
  not_invited:
    'ARRIYIA access is currently provided through a workspace invitation. If someone has invited you to their workspace, use the link from that invitation email.',
  invitation_expired: 'Your workspace invitation has expired. Ask the workspace owner to send you a new one.',
  invitation_revoked: 'This workspace invitation is no longer valid. Ask the workspace owner to send you a new one.',
}

// Must match enforce_signup_authorization()'s raised exception text
// exactly (0069_collaboration_invitation_signup_authorization.sql) — this
// is only ever reached if the client's own pre-check went stale between
// the check and the actual signUp() call (e.g. the invitation was
// cancelled in between).
const SIGNUP_AUTHORIZATION_TRIGGER_MESSAGE =
  'This email is not authorized to create an account. An admin invitation or a pending workspace invitation is required.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      // Post-10/10 password-recovery hotfix — Supabase's client parses the
      // recovery link's token out of the URL on load and fires this event;
      // it's the one reliable signal that the current session came from a
      // reset-password email rather than a normal login.
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      else if (event === 'SIGNED_OUT') setPasswordRecovery(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      passwordRecovery,
      async signUpWithPassword(email, password) {
  // V1 — Collaboration Invitation Signup Authorization. Pre-check only,
  // for accurate UI messaging before ever attempting signUp() — the
  // authoritative decision is the enforce_signup_authorization_before_insert
  // trigger on auth.users (0069_collaboration_invitation_signup_
  // authorization.sql), which authorizes via EITHER an admin-granted
  // beta_invites row OR a valid pending workspace_invitations row for
  // this email, and runs regardless of what this pre-check found.
  const { data: status, error: statusError } = await supabase.rpc('get_signup_access_status', {
    check_email: email,
  })
  if (statusError) {
    return { error: statusError.message }
  }

  if (status !== 'ok') {
    return { error: SIGNUP_DENIAL_MESSAGE[status as SignupDenialReason] ?? SIGNUP_DENIAL_MESSAGE.not_invited, denialReason: status as SignupDenialReason }
  }

  // ARRIYIA Product Completion Phase 2 — previously called with no
  // options at all, so the confirmation email's redirect fell back
  // entirely to Supabase's dashboard-configured Site URL rather than
  // this app's own canonical-domain logic. Same helper and same
  // reasoning as sendPasswordReset below (Phase 5.2): pin it to
  // VITE_SITE_URL when configured instead of leaving it to whichever
  // domain happens to be set server-side.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: canonicalSiteUrl() },
  })

  // The pre-check above can go stale between the check and this call
  // (e.g. the invitation was cancelled in between) — the database
  // trigger is still the real enforcement point and can still reject.
  // Recognized here by its exact raised message so that race case is
  // still shown as an access denial, not a generic error.
  if (error?.message === SIGNUP_AUTHORIZATION_TRIGGER_MESSAGE) {
    return { error: SIGNUP_DENIAL_MESSAGE.not_invited, denialReason: 'not_invited' }
  }

  return { error: error?.message ?? null }
},
      async signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { error: error?.message ?? null }
},
      async signInWithMagicLink(email) {
        // ARRIYIA Product Completion Phase 2 — same canonical-domain fix as
        // sendPasswordReset (Phase 5.2): window.location.origin alone
        // means this link could resolve through whichever domain served
        // the page, not necessarily the canonical ARRIYIA app.
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: canonicalSiteUrl() },
        })
        return { error: error?.message ?? null }
      },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${canonicalSiteUrl()}/reset-password`,
        })
        return { error: error?.message ?? null }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (!error) setPasswordRecovery(false)
        return { error: error?.message ?? null }
      },
      async signOut() {
        await supabase.auth.signOut()
        // Post-10/10 Phase 5 (Application Hardening & App Experience) —
        // query keys (['notes'], ['conversations'], etc.) aren't scoped by
        // user id, so without this a second user signing in on the same
        // device could transiently see the previous user's cached data
        // before background refetch overwrote it.
        queryClient.clear()
      },
    }),
    [session, loading, passwordRecovery, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
