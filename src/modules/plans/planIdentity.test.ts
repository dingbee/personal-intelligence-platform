import { describe, expect, it } from 'vitest'
import { resolvePlanIdentity } from '@/modules/plans/planIdentity'

describe('resolvePlanIdentity', () => {
  it('resolves a null plan code (no assignment row) to Free with an upgrade cue', () => {
    const result = resolvePlanIdentity({ planCode: null, foundingMemberNumber: null })
    expect(result).toEqual({ kind: 'free', label: 'Free', secondaryText: 'Upgrade available', href: '/pricing' })
  })

  it('resolves explicit free/beta/unrecognized codes to Free as well, matching PricingPage\'s own effectivePlanCode fallback', () => {
    for (const code of ['free', 'beta', 'something_unrecognized']) {
      expect(resolvePlanIdentity({ planCode: code, foundingMemberNumber: null }).kind).toBe('free')
    }
  })

  it('resolves pro to a plain Pro label with no secondary text', () => {
    const result = resolvePlanIdentity({ planCode: 'pro', foundingMemberNumber: null })
    expect(result).toEqual({ kind: 'pro', label: 'Pro', secondaryText: null, href: '/pricing' })
  })

  it('resolves founding_pro to Founding Pro with a member number when available', () => {
    const result = resolvePlanIdentity({ planCode: 'founding_pro', foundingMemberNumber: 7 })
    expect(result).toEqual({ kind: 'founding_pro', label: 'Founding Pro', secondaryText: 'Founding Member #7', href: '/pricing' })
  })

  it('resolves founding_pro with no secondary text when no member number is available (grandfathered, or data not loaded)', () => {
    const result = resolvePlanIdentity({ planCode: 'founding_pro', foundingMemberNumber: null })
    expect(result).toEqual({ kind: 'founding_pro', label: 'Founding Pro', secondaryText: null, href: '/pricing' })
  })

  it('resolves the existing enterprise plan code to the Business label (no new plan invented — see this resolver\'s own comment)', () => {
    const result = resolvePlanIdentity({ planCode: 'enterprise', foundingMemberNumber: null })
    expect(result).toEqual({ kind: 'business', label: 'Business', secondaryText: null, href: '/pricing' })
  })

  it('also resolves a literal "business" plan code to the Business label, future-proofing without requiring a schema change today', () => {
    const result = resolvePlanIdentity({ planCode: 'business', foundingMemberNumber: null })
    expect(result.kind).toBe('business')
    expect(result.label).toBe('Business')
  })

  it('never invents a founding member number for a non-founding-pro plan', () => {
    const result = resolvePlanIdentity({ planCode: 'pro', foundingMemberNumber: 42 })
    expect(result.secondaryText).toBeNull()
  })
})
