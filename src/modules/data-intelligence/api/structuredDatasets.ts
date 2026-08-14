import { supabase } from '@/shared/lib/supabase'
import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'
import type { CellValue, StructuredSheet } from '@/modules/processing/spreadsheet/types'

/**
 * Data Intelligence Foundation — the real-typed shape callers get back,
 * casting `structured_datasets.columns`/`rows` (stored as jsonb, `unknown`
 * at the database.ts layer — see getSpreadsheetAnalysis's identical
 * convention) to the concrete types the persisted grid always actually
 * has, since `saveStructuredDatasets` is the only writer.
 */
export interface StructuredDataset {
  id: string
  documentId: string
  userId: string
  workspaceId: string | null
  sheetIndex: number
  sheetName: string
  columns: ColumnAnalysis[]
  rows: CellValue[][]
  rowCount: number
  columnCount: number
}

function toStructuredDataset(row: {
  id: string
  document_id: string
  user_id: string
  workspace_id: string | null
  sheet_index: number
  sheet_name: string
  columns: unknown
  rows: unknown
  row_count: number
  column_count: number
}): StructuredDataset {
  return {
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    sheetIndex: row.sheet_index,
    sheetName: row.sheet_name,
    columns: row.columns as ColumnAnalysis[],
    rows: row.rows as CellValue[][],
    rowCount: row.row_count,
    columnCount: row.column_count,
  }
}

/**
 * Data Intelligence Foundation — persists the complete per-sheet grid
 * `structuredData` (built by the spreadsheet extractor, see
 * extractors/spreadsheet.ts) so it survives past processing in a
 * queryable form. Called once per document, right after
 * saveExtractionMetadata (processDocument.ts) — additive, does not touch
 * extraction_metadata or document_chunks. `onConflict: 'document_id,
 * sheet_index'` makes reprocessing (Reprocess action) idempotent, the
 * same way replaceDocumentChunks handles re-chunking.
 */
export async function saveStructuredDatasets(params: {
  documentId: string
  userId: string
  workspaceId: string | null
  structuredData: StructuredSheet[]
}): Promise<void> {
  const { documentId, userId, workspaceId, structuredData } = params
  if (structuredData.length === 0) return

  const { error } = await supabase.from('structured_datasets').upsert(
    structuredData.map((sheet) => ({
      document_id: documentId,
      user_id: userId,
      workspace_id: workspaceId,
      sheet_index: sheet.sheetIndex,
      sheet_name: sheet.sheetName,
      columns: sheet.columns,
      rows: sheet.rows,
      row_count: sheet.rowCount,
      column_count: sheet.columns.length,
    })),
    { onConflict: 'document_id,sheet_index' },
  )
  if (error) throw error
}

/**
 * Data Intelligence Foundation — the one read used by the deterministic
 * query engine's orchestration (runDataIntelligenceQuery.ts). RLS-scoped
 * like every other user-owned table: a dataset id belonging to another
 * user resolves to `null` here (no row visible under RLS), never an
 * error that would distinguish "doesn't exist" from "not yours" —
 * exactly the same shape as `getDocument`'s own not-found handling.
 */
export async function getStructuredDataset(datasetId: string): Promise<StructuredDataset | null> {
  const { data, error } = await supabase.from('structured_datasets').select('*').eq('id', datasetId).maybeSingle()
  if (error) throw error
  return data ? toStructuredDataset(data) : null
}

/**
 * Data Intelligence Foundation — lists a document's structured datasets
 * (one row per sheet) without their full `rows` payload, for UI surfaces
 * that only need to offer "which sheet do you want to query" (the query
 * panel) rather than the full grid.
 */
export async function listStructuredDatasetsForDocument(
  documentId: string,
): Promise<Pick<StructuredDataset, 'id' | 'sheetIndex' | 'sheetName' | 'rowCount' | 'columnCount'>[]> {
  const { data, error } = await supabase
    .from('structured_datasets')
    .select('id, sheet_index, sheet_name, row_count, column_count')
    .eq('document_id', documentId)
    .order('sheet_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    sheetIndex: row.sheet_index,
    sheetName: row.sheet_name,
    rowCount: row.row_count,
    columnCount: row.column_count,
  }))
}
