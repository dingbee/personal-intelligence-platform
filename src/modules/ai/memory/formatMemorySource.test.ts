import { describe, expect, it } from 'vitest'
import { formatMemorySource } from '@/modules/ai/memory/formatMemorySource'

describe('formatMemorySource', () => {
  it('treats null as user-provided (the only source that exists pre-UX-5.3B)', () => {
    expect(formatMemorySource(null)).toBe('User provided')
  })

  it('labels conversation-sourced memories', () => {
    expect(formatMemorySource('conversation')).toBe('Learned from conversation')
  })

  it('labels imported memories', () => {
    expect(formatMemorySource('import')).toBe('Imported')
  })

  it('falls back to User provided for an unrecognized source value', () => {
    expect(formatMemorySource('something-unexpected')).toBe('User provided')
  })

  it('labels profile-sourced memories distinctly', () => {
    expect(formatMemorySource('profile:occupation')).toBe('Set in your profile')
  })
})
