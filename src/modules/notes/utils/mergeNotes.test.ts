import { describe, expect, it } from 'vitest'
import { buildMergedNoteContent, buildMergedNoteTitle } from '@/modules/notes/utils/mergeNotes'

describe('buildMergedNoteTitle', () => {
  it('joins titles with a plus sign', () => {
    expect(buildMergedNoteTitle([{ title: 'Revenue Q1', content: '' }, { title: 'Revenue Q2', content: '' }])).toBe(
      'Merged: Revenue Q1 + Revenue Q2',
    )
  })

  it('supports more than two notes', () => {
    expect(
      buildMergedNoteTitle([
        { title: 'A', content: '' },
        { title: 'B', content: '' },
        { title: 'C', content: '' },
      ]),
    ).toBe('Merged: A + B + C')
  })
})

describe('buildMergedNoteContent', () => {
  it('renders each note as a heading followed by its content', () => {
    const result = buildMergedNoteContent([
      { title: 'First', content: 'First content.' },
      { title: 'Second', content: 'Second content.' },
    ])
    expect(result).toBe('## First\n\nFirst content.\n\n---\n\n## Second\n\nSecond content.')
  })

  it('still includes a heading for a note with empty content', () => {
    const result = buildMergedNoteContent([
      { title: 'Empty note', content: '' },
      { title: 'Real note', content: 'Some text.' },
    ])
    expect(result).toBe('## Empty note\n\n---\n\n## Real note\n\nSome text.')
  })

  it('trims leading/trailing whitespace around the whole section', () => {
    const result = buildMergedNoteContent([{ title: 'Only', content: 'padded  ' }])
    expect(result).toBe('## Only\n\npadded')
  })
})
