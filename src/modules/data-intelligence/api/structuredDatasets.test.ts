import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

beforeEach(() => {
  vi.clearAllMocks()
})

import { getStructuredDataset, listStructuredDatasetsForDocument, saveStructuredDatasets } from '@/modules/data-intelligence/api/structuredDatasets'
import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'

const columns: ColumnAnalysis[] = [{ name: 'Region', columnIndex: 0, dataType: 'category', meaning: 'category', hasFormulas: false, distinctCount: 2, nonEmptyCount: 2 }]

describe('saveStructuredDatasets', () => {
  it('upserts one row per sheet, keyed on (document_id, sheet_index)', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert: upsertMock })

    await saveStructuredDatasets({
      documentId: 'doc-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      structuredData: [
        { sheetIndex: 0, sheetName: 'Sheet1', columns, rows: [['North']], rowCount: 1 },
        { sheetIndex: 1, sheetName: 'Sheet2', columns, rows: [['South'], ['East']], rowCount: 2 },
      ],
    })

    expect(fromMock).toHaveBeenCalledWith('structured_datasets')
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({ document_id: 'doc-1', user_id: 'user-1', workspace_id: 'workspace-1', sheet_index: 0, sheet_name: 'Sheet1', row_count: 1 }),
        expect.objectContaining({ document_id: 'doc-1', sheet_index: 1, sheet_name: 'Sheet2', row_count: 2 }),
      ],
      { onConflict: 'document_id,sheet_index' },
    )
  })

  it('is a no-op for an empty structuredData array (no upsert call at all)', async () => {
    await saveStructuredDatasets({ documentId: 'doc-1', userId: 'user-1', workspaceId: null, structuredData: [] })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws on a database error rather than silently swallowing it', async () => {
    fromMock.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: new Error('boom') }) })

    await expect(
      saveStructuredDatasets({ documentId: 'doc-1', userId: 'user-1', workspaceId: null, structuredData: [{ sheetIndex: 0, sheetName: 'S', columns, rows: [], rowCount: 0 }] }),
    ).rejects.toThrow('boom')
  })
})

describe('getStructuredDataset', () => {
  it('returns the real-typed dataset for an existing row', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ds-1', document_id: 'doc-1', user_id: 'user-1', workspace_id: null,
        sheet_index: 0, sheet_name: 'Sheet1', columns, rows: [['North']], row_count: 1, column_count: 1,
      },
      error: null,
    })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }) }) })

    const result = await getStructuredDataset('ds-1')

    expect(result).toEqual({ id: 'ds-1', documentId: 'doc-1', userId: 'user-1', workspaceId: null, sheetIndex: 0, sheetName: 'Sheet1', columns, rows: [['North']], rowCount: 1, columnCount: 1 })
  })

  it('returns null for a missing (or RLS-hidden, e.g. another user\'s) dataset — never distinguishing the two', async () => {
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) })

    expect(await getStructuredDataset('missing-or-not-mine')).toBeNull()
  })
})

describe('listStructuredDatasetsForDocument', () => {
  it('returns a lightweight per-sheet list without the full rows payload', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        { id: 'ds-1', sheet_index: 0, sheet_name: 'Sheet1', row_count: 10, column_count: 3 },
        { id: 'ds-2', sheet_index: 1, sheet_name: 'Sheet2', row_count: 5, column_count: 2 },
      ],
      error: null,
    })
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderMock }) }) })

    const result = await listStructuredDatasetsForDocument('doc-1')

    expect(result).toEqual([
      { id: 'ds-1', sheetIndex: 0, sheetName: 'Sheet1', rowCount: 10, columnCount: 3 },
      { id: 'ds-2', sheetIndex: 1, sheetName: 'Sheet2', rowCount: 5, columnCount: 2 },
    ])
  })
})
