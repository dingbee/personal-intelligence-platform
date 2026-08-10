import { describe, expect, it } from 'vitest'
import { resolveFoundingProDisplayState } from '@/modules/founding-pro/foundingProState'
import type { FoundingProApplication, FoundingProMember } from '@/shared/types/database'

const BASE_INPUT = {
  isAuthenticated: true,
  isLoading: false,
  membership: null,
  latestApplication: null,
  remainingPublicSlots: 50,
}

function member(overrides: Partial<FoundingProMember> = {}): FoundingProMember {
  return {
    id: 'member-1',
    user_id: 'user-1',
    application_id: null,
    slot_type: 'public',
    founding_member_number: 7,
    founding_price_cents: 1999,
    currency: 'USD',
    founding_started_at: '2026-01-01T00:00:00Z',
    founding_expires_at: '2026-04-01T00:00:00Z',
    transition_status: 'active',
    transitioned_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function application(overrides: Partial<FoundingProApplication> = {}): FoundingProApplication {
  return {
    id: 'app-1',
    user_id: 'user-1',
    status: 'pending',
    submitted_at: '2026-01-01T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveFoundingProDisplayState', () => {
  it('returns anonymous when there is no authenticated user, regardless of other state', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, isAuthenticated: false, membership: member() })
    expect(state).toEqual({ kind: 'anonymous' })
  })

  it('returns loading while still authenticated but data is not yet resolved', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, isLoading: true })
    expect(state).toEqual({ kind: 'loading' })
  })

  it('returns member when the user already has a founding_pro_members row, even with a live application', () => {
    const m = member()
    const state = resolveFoundingProDisplayState({
      ...BASE_INPUT,
      membership: m,
      latestApplication: application({ status: 'enrolled' }),
    })
    expect(state).toEqual({ kind: 'member', member: m })
  })

  it('returns application-pending for a pending application', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, latestApplication: application({ status: 'pending' }) })
    expect(state).toEqual({ kind: 'application-pending', status: 'pending' })
  })

  it('returns application-pending for an approved-but-not-yet-enrolled application', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, latestApplication: application({ status: 'approved' }) })
    expect(state).toEqual({ kind: 'application-pending', status: 'approved' })
  })

  it('treats a rejected application as no active application, falling through to eligible-to-apply', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, latestApplication: application({ status: 'rejected' }) })
    expect(state).toEqual({ kind: 'eligible-to-apply' })
  })

  it('treats a withdrawn application as no active application', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, latestApplication: application({ status: 'withdrawn' }) })
    expect(state).toEqual({ kind: 'eligible-to-apply' })
  })

  it('returns capacity-full when no active application/membership exists but no public slots remain', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, remainingPublicSlots: 0 })
    expect(state).toEqual({ kind: 'capacity-full' })
  })

  it('returns eligible-to-apply when authenticated, no membership/application, and capacity remains', () => {
    const state = resolveFoundingProDisplayState(BASE_INPUT)
    expect(state).toEqual({ kind: 'eligible-to-apply' })
  })

  it('returns eligible-to-apply when capacity is unknown (null) rather than assuming full', () => {
    const state = resolveFoundingProDisplayState({ ...BASE_INPUT, remainingPublicSlots: null })
    expect(state).toEqual({ kind: 'eligible-to-apply' })
  })
})
