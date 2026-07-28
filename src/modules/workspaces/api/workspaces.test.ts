import { describe, expect, it } from 'vitest'
import { latestOf } from '@/modules/workspaces/api/workspaces'

describe('latestOf', () => {
  it('returns null for an empty list', () => {
    expect(latestOf([])).toBeNull()
  })

  it('returns null when every entry is null/undefined', () => {
    expect(latestOf([null, undefined, null])).toBeNull()
  })

  it('picks the lexicographically latest ISO timestamp', () => {
    expect(latestOf(['2026-01-01T00:00:00.000Z', '2026-06-15T00:00:00.000Z', '2026-03-01T00:00:00.000Z'])).toBe(
      '2026-06-15T00:00:00.000Z',
    )
  })

  it('ignores null/undefined entries mixed in with real timestamps', () => {
    expect(latestOf([null, '2026-01-01T00:00:00.000Z', undefined])).toBe('2026-01-01T00:00:00.000Z')
  })
})
