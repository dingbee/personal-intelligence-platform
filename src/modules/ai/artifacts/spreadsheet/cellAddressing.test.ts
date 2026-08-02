import { describe, expect, it } from 'vitest'
import { columnLetter } from '@/modules/ai/artifacts/spreadsheet/cellAddressing'

describe('columnLetter', () => {
  it('maps single-letter columns for indexes 0-25', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(1)).toBe('B')
    expect(columnLetter(25)).toBe('Z')
  })

  it('rolls over into double letters starting at index 26', () => {
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(27)).toBe('AB')
    expect(columnLetter(51)).toBe('AZ')
    expect(columnLetter(52)).toBe('BA')
  })

  it('handles triple letters', () => {
    expect(columnLetter(701)).toBe('ZZ')
    expect(columnLetter(702)).toBe('AAA')
  })
})
