import { describe, expect, it } from 'vitest'
import { canAccessSpace, toActiveSpaceContext, type SpaceDescriptor } from './space'

const personal: SpaceDescriptor = {
  id: 'space-personal',
  kind: 'personal',
  name: 'Personal',
  subscription: 'pro',
  status: 'active',
  ownerUserId: 'user-1',
}

const business: SpaceDescriptor = {
  id: 'space-nolmark',
  kind: 'business',
  name: 'Nolmark',
  subscription: 'enterprise',
  status: 'active',
  ownerUserId: 'user-1',
  organizationId: 'org-1',
  membershipRole: 'owner',
}

const businessMember: SpaceDescriptor = {
  ...business,
  membershipRole: 'editor',
}

describe('V2 Space context', () => {
  it('keeps one identity across personal and business spaces', () => {
    expect(toActiveSpaceContext(personal, 'user-1')).toMatchObject({
      spaceId: 'space-personal',
      kind: 'personal',
      subscription: 'pro',
      userId: 'user-1',
    })

    expect(toActiveSpaceContext(business, 'user-1')).toMatchObject({
      spaceId: 'space-nolmark',
      kind: 'business',
      subscription: 'enterprise',
      organizationId: 'org-1',
      userId: 'user-1',
      membershipRole: 'owner',
    })
  })

  it('allows a business member without requiring ownership', () => {
    expect(toActiveSpaceContext(businessMember, 'user-2')).toMatchObject({
      spaceId: 'space-nolmark',
      kind: 'business',
      membershipRole: 'editor',
      userId: 'user-2',
    })
  })

  it('keeps a paused Business Space selectable for lifecycle management', () => {
    expect(
      toActiveSpaceContext({ ...business, status: 'paused' }, 'user-1'),
    ).toMatchObject({
      spaceId: 'space-nolmark',
      status: 'paused',
    })
    expect(canAccessSpace({ ...business, status: 'paused' }, 'user-1')).toBe(true)
  })

  it('rejects an archived space', () => {
    expect(() =>
      toActiveSpaceContext({ ...business, status: 'archived' }, 'user-1'),
    ).toThrow('V2 space is archived.')
    expect(canAccessSpace({ ...business, status: 'archived' }, 'user-1')).toBe(false)
  })

  it('rejects a space with no active membership', () => {
    expect(() =>
      toActiveSpaceContext({ ...business, membershipRole: null }, 'user-2'),
    ).toThrow('V2 space is not available to the active identity.')
  })
})
