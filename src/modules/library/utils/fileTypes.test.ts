import { describe, expect, it } from 'vitest'
import { sanitizeStorageFilename } from '@/modules/library/utils/fileTypes'

describe('sanitizeStorageFilename', () => {
  it('replaces bracket characters that break Supabase Storage keys', () => {
    expect(sanitizeStorageFilename('ARUSHA_SUPERMARKETS_LIST[1].xlsx')).toBe('ARUSHA_SUPERMARKETS_LIST_1_.xlsx')
  })

  it('leaves an already-safe filename untouched', () => {
    expect(sanitizeStorageFilename('2025_Sales_Report.xlsx')).toBe('2025_Sales_Report.xlsx')
  })

  it('replaces spaces and other unsafe characters', () => {
    expect(sanitizeStorageFilename('Q3 Report (final) #2.docx')).toBe('Q3_Report__final___2.docx')
  })
})
