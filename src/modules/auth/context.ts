import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  /**
   * True from the moment Supabase's client fires a `PASSWORD_RECOVERY` auth
   * event (i.e. the user arrived via a password-reset email link and a
   * recovery session was established) until sign-out. Lets a page
   * distinguish "here via a recovery link" from "already normally logged in
   * and navigated here manually" — both end up with a truthy `session`,
   * but only the former is a genuine recovery flow.
   */
  passwordRecovery: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  /**
   * V1 — Collaboration Invitation Signup Authorization. `denialReason`
   * distinguishes *why* signup was denied — a stale invitation
   * ('invitation_expired'), a cancelled one ('invitation_revoked'), or no
   * invitation of any kind ('not_invited') — from an ordinary, unrelated
   * signup failure (network, validation, an already-registered email),
   * which leaves `denialReason` unset. The authorization decision itself
   * is never made here: this calls `get_signup_access_status()`, a
   * database function, purely to classify *why* for the UI's benefit
   * before ever attempting `signUp()`; the actual enforcement is the
   * `enforce_signup_authorization_before_insert` trigger on `auth.users`
   * (0069_collaboration_invitation_signup_authorization.sql), which runs
   * regardless of what this pre-check said.
   */
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; denialReason?: 'invitation_expired' | 'invitation_revoked' | 'not_invited' }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
