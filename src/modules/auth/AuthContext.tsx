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
  const { data: invited, error: inviteError } = await supabase.rpc(
    'is_beta_invited',
    {
      check_email: email,
    },
  )
  if (inviteError) {
    return { error: inviteError.message }
  }

  if (!invited) {
    // Pricing/Founding Pro/Beta Consolidation — this gate (is_beta_invited,
    // backed by the beta_invites table) is the platform's general
    // signup-access control, not specifically about a "Beta" product
    // tier — Beta is retired as a customer-facing plan, but this
    // invite-gated signup mechanism itself is unchanged and still in
    // active use (now also the entry point for Founding Pro invites).
    // The message is generic for the same reason.
    return { error: 'This email doesn’t have access yet. Contact us for an invitation.' }
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
