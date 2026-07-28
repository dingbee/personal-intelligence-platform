import { describe, expect, it } from 'vitest'
import { calculateProviderHealthScore, getHealthStatus } from '@/modules/ai/observability/healthScore'

describe('getHealthStatus', () => {
  it.each([
    [100, 'excellent'],
    [90, 'excellent'],
    [89, 'healthy'],
    [70, 'healthy'],
    [69, 'degraded'],
    [40, 'degraded'],
    [39, 'critical'],
    [0, 'critical'],
  ] as const)('maps score %i to %s', (score, status) => {
    expect(getHealthStatus(score)).toBe(status)
  })
})

describe('calculateProviderHealthScore', () => {
  const NOW = new Date('2026-01-08T00:00:00.000Z').getTime()

  it('scores an unavailable provider 0 regardless of history', () => {
    const score = calculateProviderHealthScore(
      { isAvailable: false, requestCount: 100, successRate: 1, avgLatencyMs: 100, lastFailure: null },
      NOW,
    )
    expect(score).toBe(0)
  })

  it('scores an available provider with no requests yet as 100', () => {
    const score = calculateProviderHealthScore(
      { isAvailable: true, requestCount: 0, successRate: null, avgLatencyMs: null, lastFailure: null },
      NOW,
    )
    expect(score).toBe(100)
  })

  it('scores a perfectly healthy provider near 100', () => {
    const score = calculateProviderHealthScore(
      { isAvailable: true, requestCount: 50, successRate: 1, avgLatencyMs: 800, lastFailure: null },
      NOW,
    )
    expect(score).toBe(100)
  })

  it('penalizes a very recent failure more than an old one, all else equal', () => {
    const recentFailureScore = calculateProviderHealthScore(
      {
        isAvailable: true,
        requestCount: 50,
        successRate: 0.9,
        avgLatencyMs: 1000,
        lastFailure: { at: new Date(NOW - 30 * 60 * 1000).toISOString() }, // 30 min ago
      },
      NOW,
    )
    const oldFailureScore = calculateProviderHealthScore(
      {
        isAvailable: true,
        requestCount: 50,
        successRate: 0.9,
        avgLatencyMs: 1000,
        lastFailure: { at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString() }, // 10 days ago
      },
      NOW,
    )
    expect(recentFailureScore).toBeLessThan(oldFailureScore)
  })

  it('penalizes high latency', () => {
    const fast = calculateProviderHealthScore(
      { isAvailable: true, requestCount: 20, successRate: 1, avgLatencyMs: 500, lastFailure: null },
      NOW,
    )
    const slow = calculateProviderHealthScore(
      { isAvailable: true, requestCount: 20, successRate: 1, avgLatencyMs: 11000, lastFailure: null },
      NOW,
    )
    expect(slow).toBeLessThan(fast)
  })

  it('scores a provider with a poor success rate and a fresh failure as critical', () => {
    const score = calculateProviderHealthScore(
      {
        isAvailable: true,
        requestCount: 20,
        successRate: 0.2,
        avgLatencyMs: 9000,
        lastFailure: { at: new Date(NOW - 5 * 60 * 1000).toISOString() },
      },
      NOW,
    )
    expect(getHealthStatus(score)).toBe('critical')
  })

  it('stays within 0-100 bounds', () => {
    const score = calculateProviderHealthScore(
      { isAvailable: true, requestCount: 1, successRate: 0, avgLatencyMs: 999999, lastFailure: { at: new Date(NOW).toISOString() } },
      NOW,
    )
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
