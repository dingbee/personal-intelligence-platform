import { describe, expect, it } from 'vitest'
import { computeWorkspaceMaturity } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'

const NOW = new Date('2026-07-29T00:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe('computeWorkspaceMaturity', () => {
  it('classifies a workspace with no activity at all as declining', () => {
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(10),
      activityTimestamps: [],
      lastActivityAt: null,
      now: NOW,
    })
    expect(result.stage).toBe('declining')
  })

  it('classifies a workspace inactive for a long time as declining even with old activity', () => {
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(200),
      activityTimestamps: [daysAgo(150), daysAgo(160)],
      lastActivityAt: daysAgo(150),
      now: NOW,
    })
    expect(result.stage).toBe('declining')
  })

  it('classifies a workspace with recent activity well above baseline as growing', () => {
    const activityTimestamps = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5), daysAgo(20)]
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(40),
      activityTimestamps,
      lastActivityAt: daysAgo(1),
      now: NOW,
    })
    expect(result.stage).toBe('growing')
  })

  it('classifies a workspace with slowing activity as stagnant', () => {
    const activityTimestamps = [daysAgo(25), daysAgo(26), daysAgo(27), daysAgo(28)]
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(50),
      activityTimestamps,
      lastActivityAt: daysAgo(25),
      now: NOW,
    })
    expect(result.stage).toBe('stagnant')
  })

  it('classifies an old workspace with a flat, steady activity rate as mature', () => {
    // One item per day for 30 days -> recent (7d) count exactly matches the rate the 30-day baseline implies.
    const activityTimestamps = Array.from({ length: 30 }, (_, i) => daysAgo(i))
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(200),
      activityTimestamps,
      lastActivityAt: daysAgo(0),
      now: NOW,
    })
    expect(result.stage).toBe('mature')
  })

  it('classifies a young workspace with a flat, steady activity rate as active', () => {
    const activityTimestamps = Array.from({ length: 30 }, (_, i) => daysAgo(i))
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(40),
      activityTimestamps,
      lastActivityAt: daysAgo(0),
      now: NOW,
    })
    expect(result.stage).toBe('active')
  })

  it('always includes a human-readable reason', () => {
    const result = computeWorkspaceMaturity({
      workspaceCreatedAt: daysAgo(10),
      activityTimestamps: [daysAgo(1)],
      lastActivityAt: daysAgo(1),
      now: NOW,
    })
    expect(result.reason.length).toBeGreaterThan(0)
    expect(result.label.length).toBeGreaterThan(0)
  })
})
