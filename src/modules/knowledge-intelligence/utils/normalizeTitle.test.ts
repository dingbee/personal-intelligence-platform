import { describe, expect, it } from 'vitest'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

describe('normalizeTitle', () => {
  it('lowercases', () => {
    expect(normalizeTitle('Marie Curie')).toBe('marie curie')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeTitle('  Marie Curie  ')).toBe('marie curie')
  })

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeTitle('Marie   Curie')).toBe('marie curie')
  })

  it('collapses tabs/newlines the same as spaces', () => {
    expect(normalizeTitle('Marie\t\nCurie')).toBe('marie curie')
  })

  it('strips punctuation without merging adjacent words', () => {
    expect(normalizeTitle('Marie, Curie')).toBe('marie curie')
    expect(normalizeTitle("O'Brien")).toBe('o brien')
    expect(normalizeTitle('Radium (element)')).toBe('radium element')
  })

  it('two already-equivalent titles normalize to the same key', () => {
    expect(normalizeTitle('Marie Curie')).toBe(normalizeTitle('  marie   curie  '))
    expect(normalizeTitle('World War II')).toBe(normalizeTitle('World War II.'))
  })

  it('is idempotent — normalizing an already-normalized title is a no-op', () => {
    const once = normalizeTitle('The Theory of Relativity!!')
    expect(normalizeTitle(once)).toBe(once)
  })

  it('preserves distinct titles as distinct keys', () => {
    expect(normalizeTitle('Marie Curie')).not.toBe(normalizeTitle('Pierre Curie'))
  })

  it('handles an empty or whitespace-only string without throwing', () => {
    expect(normalizeTitle('')).toBe('')
    expect(normalizeTitle('   ')).toBe('')
  })
})
