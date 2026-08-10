import type { FoundingProApplication, FoundingProInvitation, FoundingProMember } from '@/shared/types/database'

/**
 * Founding Pro Programme Phase 2 (extended Phase 4) — the customer-facing
 * display state for PricingPage's card, FoundingProApplyPage, and the
 * Phase 4 invitation acceptance page, resolved once as pure data so it's
 * testable without rendering anything. Precedence, in order: anonymous >
 * loading > already a member > has a pending invitation > has a live
 * (pending/approved) application > capacity is full > eligible to apply.
 * A rejected or withdrawn application is treated the same as having
 * none, matching the server's own one-active-application-per-user rule
 * (only 'pending'/'approved' rows count as "active" — see
 * submit_founding_pro_application and the
 * founding_pro_applications_one_active_per_user_idx partial unique index
 * it relies on). 'invited' takes precedence over 'application-pending'
 * because a pending invitation only ever exists for an approved
 * application (0055's own invariant), so it is strictly more specific.
 */
export type FoundingProDisplayState =
  | { kind: 'anonymous' }
  | { kind: 'loading' }
  | { kind: 'member'; member: FoundingProMember }
  | { kind: 'invited'; invitation: FoundingProInvitation }
  | { kind: 'application-pending'; status: 'pending' | 'approved' }
  | { kind: 'capacity-full' }
  | { kind: 'eligible-to-apply' }

export interface FoundingProDisplayStateInput {
  isAuthenticated: boolean
  isLoading: boolean
  membership: FoundingProMember | null
  latestApplication: FoundingProApplication | null
  pendingInvitation: FoundingProInvitation | null
  remainingPublicSlots: number | null
}

export function resolveFoundingProDisplayState(input: FoundingProDisplayStateInput): FoundingProDisplayState {
  if (!input.isAuthenticated) return { kind: 'anonymous' }
  if (input.isLoading) return { kind: 'loading' }
  if (input.membership) return { kind: 'member', member: input.membership }
  if (input.pendingInvitation) return { kind: 'invited', invitation: input.pendingInvitation }

  if (input.latestApplication && (input.latestApplication.status === 'pending' || input.latestApplication.status === 'approved')) {
    return { kind: 'application-pending', status: input.latestApplication.status }
  }

  if (input.remainingPublicSlots !== null && input.remainingPublicSlots <= 0) {
    return { kind: 'capacity-full' }
  }

  return { kind: 'eligible-to-apply' }
}
