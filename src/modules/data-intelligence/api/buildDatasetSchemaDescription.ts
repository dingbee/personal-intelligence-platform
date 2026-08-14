import type { ColumnAnalysis } from '@/modules/processing/spreadsheet/types'

/**
 * Data Intelligence Foundation — the "Schema / Data Profile" the planner
 * prompt is grounded in (see docs/intelligence-architecture-
 * reconciliation-audit.md §11's pipeline diagram). Pure formatting over
 * the same ColumnAnalysis[] already computed once at processing time and
 * persisted verbatim as structured_datasets.columns — never a re-scan of
 * raw rows, so the planner always sees exactly the columns/types the
 * execution engine will validate against.
 */
export function buildDatasetSchemaDescription(sheetName: string, columns: ColumnAnalysis[]): string {
  const lines = columns.map((c) => `- "${c.name}" — type: ${c.dataType}, meaning: ${c.meaning}, distinct values: ${c.distinctCount}, non-empty: ${c.nonEmptyCount}`)
  return `Sheet: "${sheetName}"\nColumns:\n${lines.join('\n')}`
}
