import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from '@/modules/auth/AuthContext'
import { useAuth } from '@/modules/auth/useAuth'

/**
 * Beta Invite + Quota repair, Phase 5 — the client-side half of the beta
 * gate (AuthContext.signUpWithPassword's pre-check via is_beta_invited,
 * before ever calling auth.signUp()). What this suite deliberately
 * cannot cover: invite *consumption* — that's assign_default_plan(), a
 * database trigger with no local Postgres harness in this repo (see the
 * Phase 7 manual Supabase checklist in the reconciliation report for how
 * to verify that half live).
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

const { signOutMock, resetPasswordForEmailMock, updateUserMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ error: null })),
  resetPasswordForEmailMock: vi.fn(async () => ({ error: null })),
  updateUserMock: vi.fn().mockResolvedValue({ error: null }),
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


  it('proceeds to auth.signUp for an invited email', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    signUpMock.mockResolvedValueOnce({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('invited@example.com', 'password123')

    expect(rpcMock).toHaveBeenCalledWith('is_beta_invited', { check_email: 'invited@example.com' })
    expect(signUpMock).toHaveBeenCalledWith({ email: 'invited@example.com', password: 'password123' })
    expect(outcome).toEqual({ error: null })
  })

  it('blocks a non-invited email without ever calling auth.signUp', async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('stranger@example.com', 'password123')

    expect(outcome).toEqual({ error: 'This email is not approved for beta access.' })
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('surfaces an is_beta_invited RPC error without calling auth.signUp', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'network error' } })
    const { result } = renderHook(() => useAuth(), { wrapper })

    const outcome = await result.current.signUpWithPassword('anyone@example.com', 'password123')

    expect(outcome).toEqual({ error: 'network error' })
    expect(signUpMock).not.toHaveBeenCalled()
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

  it('requests the /reset-password route on the current origin as the redirect target', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await result.current.sendPasswordReset('user@example.com')

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('user@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
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
