import { describe, expect, it } from 'vitest'
import {
  computeProfileCompletion,
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

describe('computeProfileCompletion', () => {
  it('reports 0 of 7 for an empty profile', () => {
    expect(computeProfileCompletion([])).toEqual({ completed: 0, total: 7, percent: 0 })
  })

  it('counts a single-select field as complete once it has one row', () => {
    const memories = [memory({ id: '1', source: 'profile:occupation', content: 'Business Owner' })]
    expect(computeProfileCompletion(memories).completed).toBe(1)
  })

  it('counts a multi-select field as complete once it has at least one selected value', () => {
    const memories = [memory({ id: '1', source: 'profile:expertise', content: 'Marketing' })]
    expect(computeProfileCompletion(memories).completed).toBe(1)
  })

  it('does not double-count multiple rows for the same multi-select field', () => {
    const memories = [
      memory({ id: '1', source: 'profile:expertise', content: 'Marketing' }),
      memory({ id: '2', source: 'profile:expertise', content: 'AI' }),
    ]
    expect(computeProfileCompletion(memories).completed).toBe(1)
  })

  it('reports 100% when every field has a value', () => {
    const memories = [
      memory({ id: '1', source: 'profile:occupation', content: 'Business Owner' }),
      memory({ id: '2', source: 'profile:industry', content: 'Hospitality' }),
      memory({ id: '3', source: 'profile:expertise', content: 'Marketing' }),
      memory({ id: '4', source: 'profile:goals', content: 'Grow business' }),
      memory({ id: '5', source: 'profile:communication_style', content: 'Professional' }),
      memory({ id: '6', source: 'profile:answer_length', content: 'balanced' }),
      memory({ id: '7', source: 'profile:decision_style', content: 'Analytical' }),
    ]
    expect(computeProfileCompletion(memories)).toEqual({ completed: 7, total: 7, percent: 100 })
  })

  it('ignores non-profile memories entirely', () => {
    const memories = [memory({ id: '1', source: 'conversation', content: 'Likes concise answers' })]
    expect(computeProfileCompletion(memories).completed).toBe(0)
  })
})
