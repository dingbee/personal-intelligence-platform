import { describe, expect, it } from 'vitest'
import { resolveReaderMode } from '@/modules/reader/resolveReaderMode'

describe('resolveReaderMode', () => {
  it('maps pdf to the pdf reader', () => {
    expect(resolveReaderMode('pdf')).toBe('pdf')
  })

  it('maps epub, txt, markdown, and docx to the text reader', () => {
    expect(resolveReaderMode('epub')).toBe('text')
    expect(resolveReaderMode('txt')).toBe('text')
    expect(resolveReaderMode('markdown')).toBe('text')
    expect(resolveReaderMode('docx')).toBe('text')
  })

  it('maps xlsx, csv, and ods to the spreadsheet reader', () => {
    expect(resolveReaderMode('xlsx')).toBe('spreadsheet')
    expect(resolveReaderMode('csv')).toBe('spreadsheet')
    expect(resolveReaderMode('ods')).toBe('spreadsheet')
  })
})
