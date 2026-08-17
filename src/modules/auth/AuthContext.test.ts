import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from '@/modules/auth/AuthContext'
import { useAuth } from '@/modules/auth/useAuth'

/**
 * V1 — Collaboration Invitation Signup Authorization — the client-side
 * half (AuthContext.signUpWithPassword's pre-check via
 * get_signup_access_status, before ever calling auth.signUp()). The
 * actual authorization decision is the enforce_signup_authorization_
 * before_insert database trigger (0069_collaboration_invitation_signup_
 * authorization.sql); this pre-check exists purely so the UI can show an
 * accurate denial reason before attempting signUp at all. What this
 * suite deliberately cannot cover: the trigger's own enforcement, or
 * handle_new_user's/assign_default_plan's reconciliation — those are
 * database triggers with no local Postgres harness in this repo (see
 * supabase/tests/collaboration_invitation_signup_authorization_security_
 * test.sql for that coverage, run manually against a live Supabase
 * instance).
 */
const { rpcMock, signUpMock, getSessionMock, onAuthStateChangeMock, capturedAuthListener } = vi.hoisted(() => {
  const capturedAuthListener: { current: ((event: AuthChangeEvent, session: Session | null) => void) | null } = {
    current: null,
  }
  return {
    rpcMock: vi.fn(),
    signUpMock: vi.fn(),
    getSessionMock: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChangeMock: vi.fn((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      capturedAuthListener.current = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    capturedAuthListener,
  }
})

const { signOutMock, resetPasswordForEmailMock, updateUserMock, signInWithOtpMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ error: null })),
  resetPasswordForEmailMock: vi.fn(async () => ({ error: null })),
  updateUserMock: vi.fn().mockResolvedValue({ error: null }),
  signInWithOtpMock: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signUp: signUpMock,
      signOut: signOutMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
      signInWithOtp: signInWithOtpMock,
    },
    rpc: rpcMock,
  },
}))

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, createElement(AuthProvider, null, children))
}

describe('AuthContext.signUpWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })


  it('proceeds to auth.signUp for an authorized email (workspace invitation or beta invite), redirecting the confirmation link to the current origin by default', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'ok', error: null })
    signUpMock.mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('invited@example.com', 'password123')

    expect(rpcMock).toHaveBeenCalledWith('get_signup_access_status', { check_email: 'invited@example.com' })
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'invited@example.com',
      password: 'password123',
      options: { emailRedirectTo: window.location.origin },
    })
    expect(outcome).toEqual({ error: null })
  })

  // ARRIYIA Product Completion Phase 2 — the fix for the signup
  // confirmation link resolving through whichever domain served the page
  // (previously no emailRedirectTo was set at all, so Supabase fell back
  // entirely to its own dashboard-configured Site URL).
  it('prefers VITE_SITE_URL over window.location.origin for the confirmation redirect when configured', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://app.nolmark.co/')
    rpcMock.mockResolvedValueOnce({ data: 'ok', error: null })
    signUpMock.mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signUpWithPassword('invited@example.com', 'password123')

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'invited@example.com',
      password: 'password123',
      options: { emailRedirectTo: 'https://app.nolmark.co' },
    })
    vi.unstubAllEnvs()
  })

  it('blocks an email with no invitation of any kind without ever calling auth.signUp, and flags it as a not_invited denial', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'not_invited', error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('stranger@example.com', 'password123')

    expect(outcome).toEqual({
      error: 'ARRIYIA access is currently provided through a workspace invitation. If someone has invited you to their workspace, use the link from that invitation email.',
      denialReason: 'not_invited',
    })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('blocks an expired workspace invitation with a distinct message, without calling auth.signUp', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'invitation_expired', error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('expired@example.com', 'password123')

    expect(outcome).toEqual({
      error: 'Your workspace invitation has expired. Ask the workspace owner to send you a new one.',
      denialReason: 'invitation_expired',
    })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('blocks a revoked workspace invitation with a distinct message, without calling auth.signUp', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'invitation_revoked', error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('revoked@example.com', 'password123')

    expect(outcome).toEqual({
      error: 'This workspace invitation is no longer valid. Ask the workspace owner to send you a new one.',
      denialReason: 'invitation_revoked',
    })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('surfaces a get_signup_access_status RPC error as a plain error, without a denialReason and without calling auth.signUp', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network error' } })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('anyone@example.com', 'password123')

    expect(outcome).toEqual({ error: 'network error' })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('treats a race-condition rejection from the database trigger itself (pre-check said ok, but signUp still failed) as a not_invited denial, not a generic error', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'ok', error: null })
    signUpMock.mockResolvedValueOnce({
      error: { message: 'This email is not authorized to create an account. An admin invitation or a pending workspace invitation is required.' },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('racecondition@example.com', 'password123')

    expect(outcome.denialReason).toBe('not_invited')
  })

  it('surfaces an unrelated auth.signUp failure (e.g. already-registered email) as a plain error, without a denialReason', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'ok', error: null })
    signUpMock.mockResolvedValueOnce({ error: { message: 'User already registered' } })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('existing@example.com', 'password123')

    expect(outcome).toEqual({ error: 'User already registered' })
  })

  it('never mentions "beta" anywhere in any denial message', async () => {
    for (const status of ['not_invited', 'invitation_expired', 'invitation_revoked']) {
      rpcMock.mockResolvedValueOnce({ data: status, error: null })
      const { result } = renderHook(() => useAuth(), { wrapper })
      const outcome = await result.current.signUpWithPassword('someone@example.com', 'password123')
      expect(outcome.error?.toLowerCase()).not.toContain('beta')
    }
  })
})

/**
 * Post-10/10 Phase 5 (Application Hardening & App Experience) — on a shared
 * device, query keys like ['notes']/['conversations'] aren't scoped by user
 * id, so a stale cache from the previous session could transiently render
 * for whoever signs in next unless signOut clears it.
 */
describe('AuthContext.signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  it('clears the query cache after Supabase sign-out', async () => {
    queryClient.setQueryData(['notes'], [{ id: 'stale-note' }])
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signOut()

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(['notes'])).toBeUndefined()
  })
})

/**
 * ARRIYIA Product Completion Phase 2 — magic-link sign-in previously
 * pinned emailRedirectTo to window.location.origin directly, so the link
 * could resolve through whichever domain served the page rather than the
 * canonical ARRIYIA app. Same canonicalSiteUrl() helper and fallback
 * behavior as sendPasswordReset below — password recovery itself is
 * untouched by this change.
 */
describe('AuthContext.signInWithMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redirects to the current origin by default when VITE_SITE_URL is not configured', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signInWithMagicLink('user@example.com')

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { emailRedirectTo: window.location.origin },
    })
  })

  it('prefers VITE_SITE_URL over window.location.origin when configured', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://app.nolmark.co/')
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.signInWithMagicLink('user@example.com')

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { emailRedirectTo: 'https://app.nolmark.co' },
    })
  })
})

/**
 * Post-10/10 password-recovery hotfix — the redirect Supabase sends the
 * recovery email link back to. Getting this path wrong (or having it fall
 * outside Supabase's Auth Redirect URL allowlist) is exactly what sent
 * real users to the bare app root instead of a password-change screen.
 */
describe('AuthContext.sendPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requests the /reset-password route on the current origin as the redirect target', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.sendPasswordReset('user@example.com')

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('prefers VITE_SITE_URL over window.location.origin when configured, so the redirect stays on the canonical ARRIYIA domain even if this page was served from elsewhere', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://app.nolmark.co/')
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.sendPasswordReset('user@example.com')

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.nolmark.co/reset-password',
    })
  })
})

/**
 * Post-10/10 password-recovery hotfix — Supabase's PASSWORD_RECOVERY event
 * is the one reliable signal a session came from a reset-password email
 * link rather than a normal login; this is what a page can check before
 * trusting a truthy session to mean "genuinely mid-recovery."
 */
describe('AuthContext.passwordRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  it('is false until a PASSWORD_RECOVERY event fires, then true', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(capturedAuthListener.current).not.toBeNull())

    expect(result.current.passwordRecovery).toBe(false)

    act(() => {
      capturedAuthListener.current!('PASSWORD_RECOVERY', { user: { id: 'u1' } } as unknown as Session)
    })

    await waitFor(() => expect(result.current.passwordRecovery).toBe(true))
  })

  it('resets to false on SIGNED_OUT', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(capturedAuthListener.current).not.toBeNull())

    act(() => {
      capturedAuthListener.current!('PASSWORD_RECOVERY', { user: { id: 'u1' } } as unknown as Session)
    })
    await waitFor(() => expect(result.current.passwordRecovery).toBe(true))

    act(() => {
      capturedAuthListener.current!('SIGNED_OUT', null)
    })

    await waitFor(() => expect(result.current.passwordRecovery).toBe(false))
  })
})

describe('AuthContext.updatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  it('calls supabase.auth.updateUser with the new password', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.updatePassword('newpassword1')

    expect(updateUserMock).toHaveBeenCalledWith({ password: 'newpassword1' })
    expect(outcome).toEqual({ error: null })
  })

  it('surfaces a Supabase error without throwing', async () => {
    updateUserMock.mockResolvedValueOnce({ error: { message: 'Password should be at least 6 characters.' } })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.updatePassword('a')

    expect(outcome).toEqual({ error: 'Password should be at least 6 characters.' })
  })

  it('clears passwordRecovery after a successful update', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(capturedAuthListener.current).not.toBeNull())

    act(() => {
      capturedAuthListener.current!('PASSWORD_RECOVERY', { user: { id: 'u1' } } as unknown as Session)
    })
    await waitFor(() => expect(result.current.passwordRecovery).toBe(true))

    await act(async () => {
      await result.current.updatePassword('newpassword1')
    })

    await waitFor(() => expect(result.current.passwordRecovery).toBe(false))
  })
})
