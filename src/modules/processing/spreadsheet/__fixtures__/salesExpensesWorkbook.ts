/**
 * PIP Sprint 3/10 — Spreadsheet Intelligence Validation, Phase 8's mandated
 * acceptance workbook: two sheets (Sales, Expenses), each with headers,
 * a category column, a period column (bare month labels — no year, the
 * common real-world case), and numeric/currency columns.
 *
 * Every expected total below is independently verified (see the sprint's
 * discovery doc), not assumed from the task spec. One correction worth
 * recording here since it affects how the acceptance tests are written:
 * Sales revenue for February and March both total 20,000 — the task's
 * own "February — 20,000" expectation is the deterministic first-highest
 * (insertion-order tiebreak), not a unique maximum. See
 * docs/spreadsheet-intelligence-v1-discovery.md.
 */

export const SALES_ROWS: unknown[][] = [
  ['Month', 'Product', 'Revenue', 'Cost', 'Units'],
  ['Jan', 'A', 10000, 6000, 100],
  ['Jan', 'B', 7000, 4000, 80],
  ['Feb', 'A', 12000, 6500, 110],
  ['Feb', 'B', 8000, 4500, 90],
  ['Mar', 'A', 9000, 5000, 95],
  ['Mar', 'B', 11000, 5500, 120],
]

export const EXPENSES_ROWS: unknown[][] = [
  ['Month', 'Department', 'Expense'],
  ['Jan', 'Operations', 2500],
  ['Jan', 'Marketing', 1500],
  ['Feb', 'Operations', 2800],
  ['Feb', 'Marketing', 1700],
  ['Mar', 'Operations', 2600],
  ['Mar', 'Marketing', 1800],
]

export const EXPECTED = {
  totalRevenue: 57000, // Test B
  revenueByProduct: { A: 31000, B: 26000 }, // Test C/D
  revenueByMonth: { Jan: 17000, Feb: 20000, Mar: 20000 }, // Test E (Feb/Mar tie)
  grossProfitByProduct: { A: 13500, B: 12000 }, // Test F
  expenseByDepartment: { Operations: 7900, Marketing: 5000 }, // Test G
  costByMonth: { Jan: 10000, Feb: 11000, Mar: 10500 },
  expenseByMonth: { Jan: 4000, Feb: 4500, Mar: 4400 },
  // Test H: (Revenue - Cost) - (Operations + Marketing) per month.
  combinedPerformanceByMonth: { Jan: 3000, Feb: 4500, Mar: 5100 },
} as const
