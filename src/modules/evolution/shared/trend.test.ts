import { describe, expect, it } from 'vitest'
import { countWithinDays, daysSince, deriveTrendDirection } from '@/modules/evolution/shared/trend'

describe('deriveTrendDirection', () => {
  it('returns up when there is activity but no baseline', () => {
    expect(deriveTrendDirection(3, 0, 7, 30)).toBe('up')
  })

  it('returns stable when there is no activity and no baseline', () => {
    expect(deriveTrendDirection(0, 0, 7, 30)).toBe('stable')
  })

  it('returns up when recent rate is well above the baseline rate', () => {
    // baseline: 30 over 30 days = 1/day -> expected 7 in 7 days; 10 is well above
    expect(deriveTrendDirection(10, 30, 7, 30)).toBe('up')
  })

  it('returns down when recent rate is well below the baseline rate', () => {
    expect(deriveTrendDirection(1, 30, 7, 30)).toBe('down')
  })

  it('returns stable when recent rate roughly matches the baseline rate', () => {
    expect(deriveTrendDirection(7, 30, 7, 30)).toBe('stable')
  })
})

describe('daysSince', () => {
  it('computes whole days elapsed', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    expect(daysSince('2026-07-22T00:00:00.000Z', now)).toBe(7)
  })

  it('never returns a negative number for future timestamps', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    expect(daysSince('2026-08-01T00:00:00.000Z', now)).toBe(0)
  })
})

describe('countWithinDays', () => {
  it('counts only timestamps within the window', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    const timestamps = ['2026-07-28T00:00:00.000Z', '2026-06-01T00:00:00.000Z']
    expect(countWithinDays(timestamps, now, 7)).toBe(1)
  })
})
