import type { FoundingProApplication, FoundingProMember } from '@/shared/types/database'

/**
 * Founding Pro Programme Phase 2 — the customer-facing display state for
 * both PricingPage's card and FoundingProApplyPage, resolved once as pure
 * data so it's testable without rendering anything. Precedence, in order:
 * anonymous > loading > already a member > has a live (pending/approved)
 * application > capacity is full > eligible to apply. A rejected or
 * withdrawn application is treated the same as having none, matching the
 * server's own one-active-application-per-user rule (only 'pending'/
 * 'approved' rows count as "active" — see submit_founding_pro_application
 * and the founding_pro_applications_one_active_per_user_idx partial
 * unique index it relies on).
 */
export type FoundingProDisplayState =
  | { kind: 'anonymous' }
  | { kind: 'loading' }
  | { kind: 'member'; member: FoundingProMember }
  | { kind: 'application-pending'; status: 'pending' | 'approved' }
  | { kind: 'capacity-full' }
  | { kind: 'eligible-to-apply' }

export interface FoundingProDisplayStateInput {
  isAuthenticated: boolean
  isLoading: boolean
  membership: FoundingProMember | null
  latestApplication: FoundingProApplication | null
  remainingPublicSlots: number | null
}

export function resolveFoundingProDisplayState(input: FoundingProDisplayStateInput): FoundingProDisplayState {
  if (!input.isAuthenticated) return { kind: 'anonymous' }
  if (input.isLoading) return { kind: 'loading' }
  if (input.membership) return { kind: 'member', member: input.membership }

  if (input.latestApplication && (input.latestApplication.status === 'pending' || input.latestApplication.status === 'approved')) {
    return { kind: 'application-pending', status: input.latestApplication.status }
  }

  if (input.remainingPublicSlots !== null && input.remainingPublicSlots <= 0) {
    return { kind: 'capacity-full' }
  }

  return { kind: 'eligible-to-apply' }
}
