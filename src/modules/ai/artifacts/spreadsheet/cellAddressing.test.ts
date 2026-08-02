import { describe, expect, it } from 'vitest'
import { columnLetter, decodeCellAddress } from '@/modules/ai/artifacts/spreadsheet/cellAddressing'

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

describe('decodeCellAddress', () => {
  it('decodes single-letter addresses to 0-indexed row/col', () => {
    expect(decodeCellAddress('A1')).toEqual({ row: 0, col: 0 })
    expect(decodeCellAddress('B2')).toEqual({ row: 1, col: 1 })
    expect(decodeCellAddress('Z1')).toEqual({ row: 0, col: 25 })
  })

  it('decodes double-letter addresses', () => {
    expect(decodeCellAddress('AA1')).toEqual({ row: 0, col: 26 })
    expect(decodeCellAddress('AB1')).toEqual({ row: 0, col: 27 })
  })

  it('is case-insensitive', () => {
    expect(decodeCellAddress('a1')).toEqual({ row: 0, col: 0 })
  })

  it('is the exact inverse of columnLetter for a range of indexes', () => {
    for (const index of [0, 1, 25, 26, 27, 51, 52, 701, 702]) {
      expect(decodeCellAddress(`${columnLetter(index)}1`)).toEqual({ row: 0, col: index })
    }
  })

  it('throws for a malformed address', () => {
    expect(() => decodeCellAddress('1A')).toThrow()
    expect(() => decodeCellAddress('A')).toThrow()
    expect(() => decodeCellAddress('')).toThrow()
  })
})
