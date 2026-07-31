import { describe, expect, it } from 'vitest'
import {
  getMultiProfileValues,
  getSingleProfileValue,
  isProfileMemory,
  profileFieldOf,
  profileSource,
} from '@/modules/ai/memory/profileFields'
import type { AiMemory } from '@/shared/types/database'

function memory(overrides: Partial<AiMemory> & { id: string; source: string | null; content: string }): AiMemory {
  return {
    user_id: 'u1',
    workspace_id: null,
    memory_type: 'explicit_profile',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('profileSource', () => {
  it('builds a namespaced source string', () => {
    expect(profileSource('occupation')).toBe('profile:occupation')
  })
})

describe('isProfileMemory', () => {
  it('recognizes a profile-sourced memory', () => {
    expect(isProfileMemory({ source: 'profile:occupation' })).toBe(true)
  })

  it('rejects a non-profile source', () => {
    expect(isProfileMemory({ source: 'conversation' })).toBe(false)
  })

  it('rejects a null source', () => {
    expect(isProfileMemory({ source: null })).toBe(false)
  })
})

describe('profileFieldOf', () => {
  it('extracts a known field from its source', () => {
    expect(profileFieldOf({ source: 'profile:expertise' })).toBe('expertise')
  })

  it('returns null for an unrecognized field name', () => {
    expect(profileFieldOf({ source: 'profile:unknown_field' })).toBeNull()
  })

  it('returns null for a non-profile source', () => {
    expect(profileFieldOf({ source: 'conversation' })).toBeNull()
  })

  it('returns null for a null source', () => {
    expect(profileFieldOf({ source: null })).toBeNull()
  })
})

describe('getSingleProfileValue', () => {
  it('finds the one row matching a single-select field', () => {
    const memories = [memory({ id: '1', source: 'profile:occupation', content: 'Business Owner' })]
    expect(getSingleProfileValue(memories, 'occupation')?.content).toBe('Business Owner')
  })

  it('returns null when no row matches', () => {
    expect(getSingleProfileValue([], 'occupation')).toBeNull()
  })

  it('ignores rows for other fields', () => {
    const memories = [memory({ id: '1', source: 'profile:industry', content: 'Hospitality' })]
    expect(getSingleProfileValue(memories, 'occupation')).toBeNull()
  })
})

describe('getMultiProfileValues', () => {
  it('returns every row for a multi-select field', () => {
    const memories = [
      memory({ id: '1', source: 'profile:expertise', content: 'Marketing' }),
      memory({ id: '2', source: 'profile:expertise', content: 'AI' }),
      memory({ id: '3', source: 'profile:goals', content: 'Grow business' }),
    ]
    expect(getMultiProfileValues(memories, 'expertise').map((m) => m.content)).toEqual(['Marketing', 'AI'])
  })

  it('returns an empty array when no rows match', () => {
    expect(getMultiProfileValues([], 'expertise')).toEqual([])
  })
})
