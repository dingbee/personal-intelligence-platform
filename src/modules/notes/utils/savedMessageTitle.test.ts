import { describe, expect, it } from 'vitest'
import { buildSavedMessageTitle } from '@/modules/notes/utils/savedMessageTitle'

describe('buildSavedMessageTitle', () => {
  it('uses the message content as the title when short', () => {
    expect(buildSavedMessageTitle({ content: 'Revenue grew 12% this quarter.' }, 'Marketing Strategy')).toBe(
      'Revenue grew 12% this quarter.',
    )
  })

  it('uses only the first line of a multi-line message', () => {
    expect(buildSavedMessageTitle({ content: 'Here are the key points:\n- One\n- Two' }, 'Marketing Strategy')).toBe(
      'Here are the key points:',
    )
  })

  it('truncates a long first line to 60 characters with an ellipsis', () => {
    const long = 'a'.repeat(100)
    const result = buildSavedMessageTitle({ content: long }, 'Marketing Strategy')
    expect(result).toBe(`${'a'.repeat(59)}…`)
    expect(result.length).toBe(60)
  })

  it('falls back to the conversation title when the message has no usable content', () => {
    expect(buildSavedMessageTitle({ content: '   ' }, 'Marketing Strategy')).toBe('From: Marketing Strategy')
    expect(buildSavedMessageTitle({ content: '\n\n' }, 'Marketing Strategy')).toBe('From: Marketing Strategy')
  })
})
