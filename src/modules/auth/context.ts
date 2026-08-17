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
   * V1 Launch Hardening, Workstream 1 — `notInvited` distinguishes "denied
   * by the is_beta_invited gate" from any other signup failure (network,
   * validation, an already-registered email), so the caller can offer a
   * "request access" affordance specifically for the gate denial rather
   * than on every error.
   */
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; notInvited?: boolean }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
