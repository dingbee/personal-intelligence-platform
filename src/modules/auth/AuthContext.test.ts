import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
const { rpcMock, signUpMock, getSessionMock, onAuthStateChangeMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  signUpMock: vi.fn(),
  getSessionMock: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChangeMock: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn(async () => ({ error: null })) }))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signUp: signUpMock,
      signOut: signOutMock,
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
