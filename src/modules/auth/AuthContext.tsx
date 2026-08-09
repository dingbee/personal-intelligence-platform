import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { AuthContext, type AuthContextValue } from '@/modules/auth/context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
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
    return { error: 'This email is not approved for beta access.' }
  }

  const { error } = await supabase.auth.signUp({ email, password })

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
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        return { error: error?.message ?? null }
      },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        return { error: error?.message ?? null }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
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
    [session, loading, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
