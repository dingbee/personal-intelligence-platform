import { describe, expect, it } from 'vitest'
import { clampTouchTarget, getNotificationLabel, getUsageLabel, getUsageState } from './ux14_6_hardening'

describe('UX-14.6 production hardening helpers', () => {
  it('never recommends a touch target below 44px', () => {
    expect(clampTouchTarget(24)).toBe(44)
    expect(clampTouchTarget(48)).toBe(48)
  })

  it('classifies usage at the intended thresholds', () => {
    expect(getUsageState(50, 100)).toBe('normal')
    expect(getUsageState(75, 100)).toBe('warning')
    expect(getUsageState(90, 100)).toBe('critical')
    expect(getUsageState(100, 100)).toBe('exhausted')
  })

  it('handles invalid or zero quotas safely', () => {
    expect(getUsageState(0, 0)).toBe('exhausted')
    expect(getUsageState(5, -1)).toBe('exhausted')
    expect(getUsageLabel(5, 0)).toBe('Usage limit reached')
  })

  it('uses user-facing notification labels', () => {
    expect(getNotificationLabel('proactive_recommendation')).toBe('ARRIYIA recommendation')
    expect(getNotificationLabel('quota_threshold')).toBe('Usage update')
    expect(getNotificationLabel('unknown_internal_type')).toBe('ARRIYIA notification')
  })
})
