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
    })
  })

  it('rejects a space owned by another identity', () => {
    expect(() => toActiveSpaceContext(business, 'user-2')).toThrow(
      'V2 space does not belong to the active identity.',
    )
  })

  it('rejects inactive spaces', () => {
    expect(() =>
      toActiveSpaceContext({ ...business, status: 'paused' }, 'user-1'),
    ).toThrow('V2 space is not active.')
  })

  it('does not treat personal and business spaces as interchangeable', () => {
    expect(personal.kind).toBe('personal')
    expect(business.kind).toBe('business')
    expect(canAccessSpace(personal, 'user-1')).toBe(true)
    expect(canAccessSpace(business, 'user-2')).toBe(false)
  })
})
