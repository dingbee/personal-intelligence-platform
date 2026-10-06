import type { UUID } from '../domain/model'

export type SpaceKind = 'personal' | 'business'
export type SpaceStatus = 'active' | 'paused' | 'archived'
export type SpaceSubscription = 'pro' | 'enterprise'

export interface SpaceDescriptor {
  id: UUID
  kind: SpaceKind
  name: string
  subscription: SpaceSubscription
  status: SpaceStatus
  ownerUserId: UUID
  organizationId?: UUID
}

export interface ActiveSpaceContext {
  spaceId: UUID
  kind: SpaceKind
  organizationId?: UUID
  subscription: SpaceSubscription
  userId: UUID
}

/**
 * V2 Space is the active operating context for identity-scoped enterprise
 * features. This is deliberately separate from the legacy V1 workspace
 * preference, which is a client-side library filter.
 */
export function toActiveSpaceContext(
  space: SpaceDescriptor,
  userId: UUID,
): ActiveSpaceContext {
  if (space.ownerUserId !== userId) {
    throw new Error('V2 space does not belong to the active identity.')
  }

  if (space.status !== 'active') {
    throw new Error('V2 space is not active.')
  }

  return {
    spaceId: space.id,
    kind: space.kind,
    organizationId: space.organizationId,
    subscription: space.subscription,
    userId,
  }
}

export function canAccessSpace(
  space: SpaceDescriptor,
  userId: UUID,
): boolean {
  return space.ownerUserId === userId && space.status === 'active'
}
