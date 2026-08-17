import { describe, expect, it } from 'vitest'
import { inferResponseStyleHint } from '@/modules/intelligence/personality/responseStyle'

describe('inferResponseStyleHint', () => {
  it('treats a short direct question as brief', () => {
    expect(inferResponseStyleHint('What year was that?')).toBe('brief')
  })

  it('treats an "explain"/"explore" style question as exploratory even if short', () => {
    expect(inferResponseStyleHint('Explain why.')).toBe('exploratory')
  })

  it('treats a longer, plain question as standard', () => {
    expect(inferResponseStyleHint('What were the main causes of the decline described in chapter three of this book?')).toBe(
      'standard',
    )
  })

  it('treats an empty query as standard (no crash on empty input)', () => {
    expect(inferResponseStyleHint('')).toBe('standard')
  })
})
