import type { ColumnAnalysis, FinancialPattern } from '@/modules/processing/spreadsheet/types'

interface PatternRule {
  pattern: Exclude<FinancialPattern, 'unknown'>
  matches: (headers: string[]) => boolean
}

const has = (headers: string[], re: RegExp) => headers.some((h) => re.test(h))

// UX-13.10.1 — same vocabulary expansion as columnAnalysis's CURRENCY_HEADER:
// real spreadsheets say "turnover," "takings," "overhead," "surplus," not
// only the literal accounting terms.
const REVENUE_WORDS = /revenue|sales|income|turnover|earnings|receipts|takings|collections|inflow/i
const COST_WORDS = /cost|costs|expense|expenses|expenditure|cogs|spending|overhead|outflow/i
const PROFIT_WORDS = /profit|margin|net|surplus|earnings/i

/**
 * UX-13.10 — ordered rule table, first match wins, same shape as
 * classifyIntent: fully deterministic, no AI call, ships with an explicit
 * 'unknown' fallback rather than forcing every sheet into a category.
 * Stops here by design — no report generation, no cross-sheet reasoning.
 */
const RULES: PatternRule[] = [
  {
    pattern: 'income-statement',
    matches: (h) => has(h, REVENUE_WORDS) && has(h, COST_WORDS) && has(h, PROFIT_WORDS),
  },
  {
    pattern: 'inventory',
    matches: (h) => has(h, /\bsku\b|item code|product code/i) && has(h, /stock|quantity|inventory|units on hand/i),
  },
  {
    pattern: 'customer-sheet',
    matches: (h) => has(h, /customer|client/i) && has(h, /purchase|order|frequency|spend|lifetime value/i),
  },
  {
    pattern: 'expense-sheet',
    matches: (h) => has(h, /category|department|type/i) && (has(h, COST_WORDS) || has(h, /\bamount\b/i)) && !has(h, REVENUE_WORDS),
  },
  {
    pattern: 'sales-data',
    matches: (h) => (has(h, /customer|product/i) || has(h, /region/i)) && (has(h, REVENUE_WORDS) || has(h, /\bamount\b/i)),
  },
]

export function classifyFinancialPattern(columns: ColumnAnalysis[]): FinancialPattern {
  const headers = columns.map((c) => c.name.toLowerCase())
  for (const rule of RULES) {
    if (rule.matches(headers)) return rule.pattern
  }
  return 'unknown'
}
