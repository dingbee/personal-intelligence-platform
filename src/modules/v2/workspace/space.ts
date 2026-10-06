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
 * V2 Space is the operating context for identity-scoped enterprise features.
 * A paused Business Space remains selectable for lifecycle management but
 * cannot be treated as an active execution context by downstream features.
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

  if (space.status === 'archived') {
    throw new Error('V2 space is archived.')
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

  return identityCanAccess && space.status !== 'archived'
}
