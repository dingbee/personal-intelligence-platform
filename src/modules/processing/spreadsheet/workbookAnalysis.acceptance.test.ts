import { describe, expect, it } from 'vitest'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { formatSpreadsheetContextText } from '@/modules/processing/spreadsheet/formatForChat'
import { EXPECTED, EXPENSES_ROWS, SALES_ROWS } from '@/modules/processing/spreadsheet/__fixtures__/salesExpensesWorkbook'

function breakdown(sheet: ReturnType<typeof analyzeSheet>, categoryColumn: string, valueColumn: string) {
  return sheet.aggregates.categoryBreakdowns.find((b) => b.categoryColumn === categoryColumn && b.valueColumn === valueColumn)
}

function total(bd: ReturnType<typeof breakdown>, category: string): number | undefined {
  return bd?.breakdown.find((row) => row.category === category)?.total
}

/**
 * PIP Sprint 3/10 — Mandatory Acceptance Test (Phase 9), tested at the
 * deterministic calculation layer per Phase 11's explicit instruction: "Do
 * not rely exclusively on LLM-generated assertions. Where calculations can
 * be deterministic, test them deterministically." These prove the
 * *figures* PIP grounds its answers in are correct; whether the live model
 * phrases them correctly is a separate, non-deterministic concern (see the
 * sprint's discovery/acceptance docs for what could and couldn't be
 * verified in this environment).
 */
describe('Sprint 3/10 acceptance workbook — Sales + Expenses', () => {
  const sales = analyzeSheet(SALES_ROWS, 0, 'Sales')
  const expenses = analyzeSheet(EXPENSES_ROWS, 1, 'Expenses')

  it('Test B — total revenue across all months', () => {
    const revenueStats = sales.aggregates.columnStats.find((s) => s.column === 'Revenue')
    expect(revenueStats?.sum).toBe(EXPECTED.totalRevenue)
  })

  it('Test C/D — revenue by product, Product A highest', () => {
    const byProduct = breakdown(sales, 'Product', 'Revenue')
    expect(total(byProduct, 'A')).toBe(EXPECTED.revenueByProduct.A)
    expect(total(byProduct, 'B')).toBe(EXPECTED.revenueByProduct.B)
    expect(byProduct?.best?.category).toBe('A')
  })

  it('Test E — revenue by month, February is highest (tied with March, first by deterministic order)', () => {
    const byMonth = breakdown(sales, 'Month', 'Revenue')
    expect(total(byMonth, 'Jan')).toBe(EXPECTED.revenueByMonth.Jan)
    expect(total(byMonth, 'Feb')).toBe(EXPECTED.revenueByMonth.Feb)
    expect(total(byMonth, 'Mar')).toBe(EXPECTED.revenueByMonth.Mar)
    // February and March are numerically tied at 20,000 — the fixture's
    // own ground truth (see the module doc comment). This assertion pins
    // the deterministic tiebreak (stable sort + Jan/Feb/Mar insertion
    // order) that makes February rank first, matching the task's stated
    // expectation, without pretending the tie doesn't exist.
    expect(byMonth?.best?.category).toBe('Feb')
    expect(byMonth?.best?.total).toBe(20000)
  })

  it('Test F — gross profit by product (Revenue - Cost), Product A highest', () => {
    const revenueByProduct = breakdown(sales, 'Product', 'Revenue')
    const costByProduct = breakdown(sales, 'Product', 'Cost')
    expect(costByProduct).toBeDefined() // the fix under test: Cost now gets its own breakdown, not just Revenue
    const profitA = total(revenueByProduct, 'A')! - total(costByProduct, 'A')!
    const profitB = total(revenueByProduct, 'B')! - total(costByProduct, 'B')!
    expect(profitA).toBe(EXPECTED.grossProfitByProduct.A)
    expect(profitB).toBe(EXPECTED.grossProfitByProduct.B)
  })

  it('Test G — operating (Operations department) expenses across all months', () => {
    const byDept = breakdown(expenses, 'Department', 'Expense')
    expect(total(byDept, 'Operations')).toBe(EXPECTED.expenseByDepartment.Operations)
  })

  it('Test H — combined financial performance by month is computable from both sheets', () => {
    const revenueByMonth = breakdown(sales, 'Month', 'Revenue')
    const costByMonth = breakdown(sales, 'Month', 'Cost')
    const expenseByMonth = breakdown(expenses, 'Month', 'Expense')
    expect(costByMonth).toBeDefined()
    expect(expenseByMonth).toBeDefined()

    const combined: Record<string, number> = {}
    for (const month of ['Jan', 'Feb', 'Mar']) {
      const profit = total(revenueByMonth, month)! - total(costByMonth, month)!
      combined[month] = profit - total(expenseByMonth, month)!
    }
    expect(combined).toEqual(EXPECTED.combinedPerformanceByMonth)
    // March, not February, has the strongest combined performance — a
    // genuine discrepancy between the task's Test J premise ("why was
    // February stronger than March") and the fixture's actual numbers.
    // Documented, not silently resolved by altering the fixture.
    expect(Object.entries(combined).sort((a, b) => b[1] - a[1])[0]![0]).toBe('Mar')
  })

  it('cross-sheet grounding text includes figures from both sheets in one block', () => {
    const text = formatSpreadsheetContextText([sales, expenses])
    expect(text).toContain('Sheet: Sales')
    expect(text).toContain('Sheet: Expenses')
    expect(text).toContain('Revenue by Month')
    expect(text).toContain('Cost by Month')
    expect(text).toContain('Expense by Month')
    expect(text).toContain('Expense by Department')
  })

  it('Test I — grounding text carries enough real figures for a semantic/insights answer', () => {
    const text = formatSpreadsheetContextText([sales, expenses])!
    // Total revenue (57,000) is the Revenue column's computed sum.
    expect(text).toContain('Revenue: sum 57,000')
    // Best/worst product and department comparisons, both real evidence
    // an "insights" answer can cite instead of fabricating a claim.
    expect(text).toMatch(/Best: A .*Worst: B/)
    expect(text).toMatch(/Best: Operations .*Worst: Marketing/)
  })
})
