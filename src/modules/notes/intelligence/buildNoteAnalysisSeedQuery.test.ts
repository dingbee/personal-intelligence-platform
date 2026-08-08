import { describe, expect, it } from 'vitest'
import { buildNoteAnalysisSeedQuery } from '@/modules/notes/intelligence/buildNoteAnalysisSeedQuery'

describe('buildNoteAnalysisSeedQuery', () => {
  it('carries the real note content into the seed message, not just the title', () => {
    const query = buildNoteAnalysisSeedQuery('Q3 planning', 'We decided to ship by October 1st. John owns the launch.')
    expect(query).toContain('Q3 planning')
    expect(query).toContain('We decided to ship by October 1st. John owns the launch.')
  })

  it('asks for the specific extraction targets the milestone requires', () => {
    const query = buildNoteAnalysisSeedQuery('Notes', 'Some content.')
    expect(query).toMatch(/main ideas/i)
    expect(query).toMatch(/decisions/i)
    expect(query).toMatch(/dates/i)
    expect(query).toMatch(/tasks/i)
    expect(query).toMatch(/priorities/i)
    expect(query).toMatch(/people/i)
  })

  it('asks NOVA to keep categories distinct rather than blending them into one summary', () => {
    const query = buildNoteAnalysisSeedQuery('Notes', 'Some content.')
    expect(query).toMatch(/distinct/i)
  })

  it('is honest about an empty note rather than fabricating something to analyze', () => {
    const query = buildNoteAnalysisSeedQuery('Empty note', '')
    expect(query).toContain('Empty note')
    expect(query).toMatch(/empty/i)
    expect(query).not.toMatch(/main ideas/i)
  })

  it('treats whitespace-only content the same as empty', () => {
    const query = buildNoteAnalysisSeedQuery('Whitespace note', '   \n\t  ')
    expect(query).toMatch(/empty/i)
  })

  it('trims surrounding whitespace from real content', () => {
    const query = buildNoteAnalysisSeedQuery('Note', '  Some real content.  \n')
    expect(query).toContain('Please analyze this note titled "Note":\n\nSome real content.\n\nSummarize')
  })
})
