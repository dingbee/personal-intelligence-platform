import { describe, expect, it } from 'vitest'
import { getInitials } from '@/shared/utils/getInitials'

describe('getInitials', () => {
  it('uses the first letter of each of the first two words in a display name', () => {
    expect(getInitials('Ada Lovelace', 'ada@example.com')).toBe('AL')
  })

  it('falls back to the email when display name is null', () => {
    expect(getInitials(null, 'ada@example.com')).toBe('AD')
  })

  it('falls back to the email when display name is blank', () => {
    expect(getInitials('   ', 'ada@example.com')).toBe('AD')
  })

  it('uses the first two characters of a single-word name', () => {
    expect(getInitials('Ada', 'ada@example.com')).toBe('AD')
  })

  it('always uppercases the result', () => {
    expect(getInitials('ada lovelace', 'ada@example.com')).toBe('AL')
  })
})
