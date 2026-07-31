import type { ColumnDataType, ColumnMeaning } from '@/modules/processing/spreadsheet/types'
import { isNonEmptyCell, looksLikeCurrencyText, parseDateValue, parseNumericValue } from '@/modules/processing/spreadsheet/cellParsing'

const DATE_HEADER = /\b(date|period|month|year|quarter|time|when|day)\b/i
// UX-13.10.1 — expanded past the literal accounting terms to how people
// actually phrase these columns: "turnover"/"takings"/"collections" for
// revenue, "overhead"/"expenditure"/"outflow" for expenses, "surplus" for
// profit. Users ask "what were the largest expenses," not "what was COGS."
const CURRENCY_HEADER =
  /\b(price|revenue|cost|costs|amount|expense|expenses|expenditure|profit|margin|value|salary|budget|income|sales|turnover|earnings|receipts|takings|collections|total|fee|payment|cogs|spending|overhead|outflow|inflow|surplus)\b/i
const CATEGORY_HEADER = /\b(region|category|type|status|department|segment|product|country|city|channel)\b/i
const MAX_CATEGORY_DISTINCT = 50

/** UX-13.10 — deterministic, header-name + sample-value heuristics, same "no AI, no network" spirit as classifyIntent. Never guesses past what the data actually shows. */
export function detectColumnType(header: string, values: unknown[]): ColumnDataType {
  const nonEmpty = values.filter(isNonEmptyCell)
  if (nonEmpty.length === 0) return 'text'

  if (DATE_HEADER.test(header)) {
    const dateHits = nonEmpty.filter((v) => parseDateValue(v) !== null).length
    if (dateHits / nonEmpty.length > 0.6) return 'date'
  }

  const currencyTextHits = nonEmpty.filter(looksLikeCurrencyText).length
  const numericHits = nonEmpty.filter((v) => parseNumericValue(v) !== null).length
  if ((CURRENCY_HEADER.test(header) || currencyTextHits / nonEmpty.length > 0.5) && numericHits / nonEmpty.length > 0.5) {
    return 'currency'
  }

  if (numericHits / nonEmpty.length > 0.5) return 'number'

  const distinctCount = new Set(nonEmpty.map((v) => String(v).toLowerCase().trim())).size
  const distinctRatio = distinctCount / nonEmpty.length
  if (distinctCount <= MAX_CATEGORY_DISTINCT && (distinctRatio <= 0.5 || CATEGORY_HEADER.test(header))) {
    return 'category'
  }

  return 'text'
}

export function detectColumnMeaning(header: string, dataType: ColumnDataType): ColumnMeaning {
  if (/\b(customer|client|user|employee|vendor|supplier|name|contact)\b/i.test(header)) return 'entity'
  if (dataType === 'date' || DATE_HEADER.test(header)) return 'timeline'
  if (dataType === 'currency') return 'currency'
  if (CATEGORY_HEADER.test(header)) return 'category'
  if (/\b(id|sku|code|number|no\.?)\b/i.test(header)) return 'identifier'
  if (dataType === 'number') return 'metric'
  if (dataType === 'category') return 'category'
  return 'text'
}

/** Returns an ISO 4217 code only when the data gives real evidence (a symbol or code) — never a default guess. */
export function detectCurrencySymbol(header: string, values: unknown[]): string | null {
  const codeMatch = header.match(/\b(USD|EUR|GBP|JPY|CAD|AUD)\b/i)
  if (codeMatch) return codeMatch[1]!.toUpperCase()
  if (header.includes('$')) return 'USD'
  if (header.includes('€')) return 'EUR'
  if (header.includes('£')) return 'GBP'

  for (const value of values) {
    if (typeof value !== 'string') continue
    if (value.includes('$')) return 'USD'
    if (value.includes('€')) return 'EUR'
    if (value.includes('£')) return 'GBP'
    const codeInValue = value.match(/\b(USD|EUR|GBP|JPY|CAD|AUD)\b/i)
    if (codeInValue) return codeInValue[1]!.toUpperCase()
  }
  return null
}
