import { describe, expect, it } from 'vitest'
import { canSelectProvider } from '@/modules/plans/entitlements'

describe('canSelectProvider', () => {
  it('denies free', () => {
    expect(canSelectProvider('free')).toBe(false)
  })

  it('denies beta', () => {
    expect(canSelectProvider('beta')).toBe(false)
  })

  it('allows pro', () => {
    expect(canSelectProvider('pro')).toBe(true)
  })

  it('allows enterprise', () => {
    expect(canSelectProvider('enterprise')).toBe(true)
  })

  it('denies an unrecognized plan code', () => {
    expect(canSelectProvider('mystery-plan')).toBe(false)
  })

  it('denies null/undefined (no resolved plan yet, or none assigned)', () => {
    expect(canSelectProvider(null)).toBe(false)
    expect(canSelectProvider(undefined)).toBe(false)
  })
})
