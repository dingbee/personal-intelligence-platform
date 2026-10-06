import type { UUID } from '../domain/model'

export type SpaceKind = 'personal' | 'business'
export type SpaceStatus = 'active' | 'paused' | 'archived'
export type SpaceSubscription = 'pro' | 'enterprise'

export type SpaceMembershipRole = 'viewer' | 'editor' | 'owner'

export interface SpaceDescriptor {
  id: UUID
  kind: SpaceKind
  name: string
  subscription: SpaceSubscription
  status: SpaceStatus
  ownerUserId: UUID
  organizationId?: UUID
  membershipRole?: SpaceMembershipRole | null
}

export interface ActiveSpaceContext {
  spaceId: UUID
  name: string
  kind: SpaceKind
  organizationId?: UUID
  subscription: SpaceSubscription
  status: SpaceStatus
  userId: UUID
  membershipRole?: SpaceMembershipRole | null
}

/**
 * V2 Space is the active operating context for identity-scoped enterprise
 * features. Business Spaces are persistent membership-backed contexts;
 * Personal Space is identity-owned.
 */
export function toActiveSpaceContext(
  space: SpaceDescriptor,
  userId: UUID,
): ActiveSpaceContext {
  const canAccess =
    space.kind === 'personal'
      ? space.ownerUserId === userId
      : Boolean(space.membershipRole)

  if (!canAccess) {
    throw new Error('V2 space is not available to the active identity.')
  }

  if (space.status !== 'active') {
    throw new Error('V2 space is not active.')
  }

  return {
    spaceId: space.id,
    name: space.name,
    kind: space.kind,
    organizationId: space.organizationId,
    subscription: space.subscription,
    status: space.status,
    userId,
    membershipRole: space.membershipRole ?? null,
  }
}

export function canAccessSpace(
  space: SpaceDescriptor,
  userId: UUID,
): boolean {
  const identityCanAccess =
    space.kind === 'personal'
      ? space.ownerUserId === userId
      : Boolean(space.membershipRole)

  return identityCanAccess && space.status === 'active'
}
