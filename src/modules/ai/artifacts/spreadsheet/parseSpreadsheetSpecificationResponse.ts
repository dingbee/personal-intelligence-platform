import type {
  SpreadsheetColumnType,
  SpreadsheetSpecification,
  SpreadsheetSpecificationColumn,
  SpreadsheetSpecificationFormula,
  SpreadsheetSpecificationRow,
  SpreadsheetSpecificationSheet,
} from '@/modules/ai/artifacts/spreadsheet/specificationTypes'

/**
 * UX-14.4.2 — extracts a `SpreadsheetSpecification`-shaped object from a
 * model response, tolerating markdown code fences: the same convention
 * `parseKnowledgeExtractionResponse.ts` already uses for JSON *arrays*,
 * applied here to a JSON *object*. Deliberately loose on the way in —
 * missing or wrong-typed fields are coerced to safe, obviously-invalid
 * defaults (empty string, empty array, 0) rather than thrown on, so a
 * structurally-malformed response still reaches
 * `validateSpreadsheetSpecification`, which reports exactly what's wrong
 * with specific, actionable error codes instead of a generic parse
 * failure. Only a response with no JSON object in it at all is a hard
 * failure here — everything else is the validator's job.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model response did not contain a JSON object.')
  }

  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1))
  if (!isRecord(parsed)) {
    throw new Error('Expected a JSON object.')
  }
  return parsed
}

function coerceString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function coerceValue(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

function coerceColumn(value: unknown): SpreadsheetSpecificationColumn {
  const record = isRecord(value) ? value : {}
  const column: SpreadsheetSpecificationColumn = { name: coerceString(record.name) }
  if (typeof record.type === 'string') column.type = record.type as SpreadsheetColumnType
  return column
}

function coerceRow(value: unknown): SpreadsheetSpecificationRow {
  const record = isRecord(value) ? value : {}
  const values = Array.isArray(record.values) ? record.values : []
  return { values: values.map(coerceValue) }
}

function coerceFormula(value: unknown): SpreadsheetSpecificationFormula {
  const record = isRecord(value) ? value : {}
  return {
    column: coerceString(record.column),
    row: typeof record.row === 'number' ? record.row : 0,
    expression: coerceString(record.expression),
  }
}

function coerceSheet(value: unknown): SpreadsheetSpecificationSheet {
  const record = isRecord(value) ? value : {}
  const sheet: SpreadsheetSpecificationSheet = {
    name: coerceString(record.name),
    columns: Array.isArray(record.columns) ? record.columns.map(coerceColumn) : [],
    rows: Array.isArray(record.rows) ? record.rows.map(coerceRow) : [],
  }
  if (Array.isArray(record.formulas)) sheet.formulas = record.formulas.map(coerceFormula)
  return sheet
}

/**
 * Parses a model response into a `SpreadsheetSpecification`-shaped value.
 * Never throws for structurally-wrong-but-present fields — only when no
 * JSON object can be found in the response at all. The caller must still
 * run this through `validateSpreadsheetSpecification` before treating it
 * as trustworthy; this function only makes the shape safe to inspect.
 */
export function parseSpreadsheetSpecificationResponse(text: string): SpreadsheetSpecification {
  const record = extractJsonObject(text)
  return {
    title: coerceString(record.title),
    kind: coerceString(record.kind) as SpreadsheetSpecification['kind'],
    sheets: Array.isArray(record.sheets) ? record.sheets.map(coerceSheet) : [],
  }
}
