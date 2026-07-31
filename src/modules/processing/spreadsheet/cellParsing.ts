/** UX-13.10 — shared cell-value parsing used by both column-type detection and the calculations layer, so a value is never classified one way and parsed another. */

const MIN_EXCEL_SERIAL = 1 // 1899-12-31
const MAX_EXCEL_SERIAL = 60000 // ~2064, generous upper bound for real-world data

export function isNonEmptyCell(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/** Excel serial date (days since 1899-12-30) → ISO 'YYYY-MM-DD'. SheetJS's own convention (no cellDates option used anywhere in this pipeline, see spreadsheet.ts). */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < MIN_EXCEL_SERIAL || serial > MAX_EXCEL_SERIAL) return null
  const epoch = Date.UTC(1899, 11, 30)
  const ms = epoch + serial * 86400000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

/** Parses a cell into an ISO 'YYYY-MM-DD' string, or null if it isn't plausibly a date. Handles both Excel serial numbers and human-typed date strings. */
export function parseDateValue(value: unknown): string | null {
  if (typeof value === 'number') return excelSerialToIsoDate(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return null
    const year = parsed.getUTCFullYear()
    if (year < 1970 || year > 2100) return null
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

/** Parses a cell into a plain number, stripping currency symbols/thousands separators/percent signs a human typed into a text cell (e.g. "$1,234.56", "45%"). Returns null when the cell isn't numeric at all. */
export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const isPercent = trimmed.endsWith('%')
  const stripped = trimmed.replace(/[$€£,\s%]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(stripped)) return null
  const parsed = Number.parseFloat(stripped)
  if (!Number.isFinite(parsed)) return null
  return isPercent ? parsed / 100 : parsed
}

export function looksLikeCurrencyText(value: unknown): boolean {
  return typeof value === 'string' && /^[$€£]\s?-?[\d,]+(\.\d+)?$/.test(value.trim())
}
