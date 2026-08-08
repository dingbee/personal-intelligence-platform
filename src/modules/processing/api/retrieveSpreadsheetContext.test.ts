import { describe, expect, it, vi } from 'vitest'

const { getExtractionMetadataMock } = vi.hoisted(() => ({ getExtractionMetadataMock: vi.fn() }))
vi.mock('@/modules/processing/api/extractionMetadata', async () => {
  const actual = await vi.importActual<typeof import('@/modules/processing/api/extractionMetadata')>(
    '@/modules/processing/api/extractionMetadata',
  )
  return { ...actual, getExtractionMetadata: getExtractionMetadataMock }
})

import { retrieveSpreadsheetContext } from '@/modules/processing/api/retrieveSpreadsheetContext'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { SALES_ROWS } from '@/modules/processing/spreadsheet/__fixtures__/salesExpensesWorkbook'
import type { ExtractionMetadata } from '@/shared/types/database'

function metadataWith(spreadsheet: unknown): ExtractionMetadata {
  return {
    document_id: 'doc-1',
    user_id: 'user-1',
    title: null,
    author: null,
    language: null,
    page_count: null,
    chapter_count: null,
    word_count: null,
    char_count: null,
    metadata: { chapters: [], spreadsheet },
    created_at: '',
    updated_at: '',
  } as unknown as ExtractionMetadata
}

/**
 * PIP Sprint 3/10, Phase 11 — "spreadsheet context retrieval" from the
 * task's own list. Mirrors retrieveGraphContext's never-throw contract
 * (see this function's own doc comment): a missing document, a
 * non-spreadsheet document, or a Supabase failure must all fall back to
 * null, never break the chat turn.
 */
describe('retrieveSpreadsheetContext', () => {
  it('returns null when no documentId is given', async () => {
    expect(await retrieveSpreadsheetContext(undefined)).toBeNull()
    expect(getExtractionMetadataMock).not.toHaveBeenCalled()
  })

  it('returns formatted grounding text when the document has spreadsheet analysis', async () => {
    const analysis = analyzeSheet(SALES_ROWS, 0, 'Sales')
    getExtractionMetadataMock.mockResolvedValueOnce(metadataWith([analysis]))

    const text = await retrieveSpreadsheetContext('doc-1')

    expect(text).toContain('Sheet: Sales')
    expect(text).toContain('57,000')
  })

  it('returns null for a non-spreadsheet document (no spreadsheet metadata)', async () => {
    getExtractionMetadataMock.mockResolvedValueOnce(metadataWith(undefined))
    expect(await retrieveSpreadsheetContext('doc-2')).toBeNull()
  })

  it('returns null, never throws, when the metadata lookup fails', async () => {
    getExtractionMetadataMock.mockRejectedValueOnce(new Error('network error'))
    await expect(retrieveSpreadsheetContext('doc-3')).resolves.toBeNull()
  })
})
