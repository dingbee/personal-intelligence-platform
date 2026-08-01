import { describe, expect, it } from 'vitest'
import { parseExecutiveBriefingCommand } from '@/modules/knowledge-intelligence/api/executiveBriefingCommand'

describe('parseExecutiveBriefingCommand', () => {
  it('parses the canonical phrasing', () => {
    expect(parseExecutiveBriefingCommand('Create an executive briefing on Revenue.')).toEqual({ topic: 'Revenue' })
  })

  it('accepts create/generate/write, with/without "executive", and on/about/for', () => {
    expect(parseExecutiveBriefingCommand('Generate a briefing about Mtoni River Lodge')).toEqual({ topic: 'Mtoni River Lodge' })
    expect(parseExecutiveBriefingCommand('Write an executive briefing for Marketing Campaign')).toEqual({
      topic: 'Marketing Campaign',
    })
    expect(parseExecutiveBriefingCommand('create briefing on Revenue')).toEqual({ topic: 'Revenue' })
  })

  it('is case-insensitive and tolerates surrounding whitespace and trailing punctuation', () => {
    expect(parseExecutiveBriefingCommand('  CREATE AN EXECUTIVE BRIEFING ON revenue!!  ')).toEqual({ topic: 'revenue' })
  })

  it('returns null for ordinary chat messages', () => {
    expect(parseExecutiveBriefingCommand('What do you know about Revenue?')).toBeNull()
    expect(parseExecutiveBriefingCommand('Can you summarize our conversation?')).toBeNull()
    expect(parseExecutiveBriefingCommand('briefing on Revenue')).toBeNull()
  })

  it('returns null when no topic follows the command phrase', () => {
    expect(parseExecutiveBriefingCommand('Create an executive briefing on')).toBeNull()
    expect(parseExecutiveBriefingCommand('Create an executive briefing on   ')).toBeNull()
  })
})
