/**
 * Data Intelligence Foundation — acceptance fixture shaped like the
 * audit's Product Sales Excel benchmark (docs/intelligence-architecture-
 * reconciliation-audit.md §10): Region/Product/Store/Salesperson/
 * CustomerType/Quantity/UnitPrice/Discount/Promotion/Returned/
 * ShippingCost/Payment/OrderDate/DeliveryDate, spanning 2023 through
 * June 2025 — same fields, same date range, same question types as the
 * benchmark table, at a size (30 transactions) small enough for every
 * expected value below to be independently hand-verified.
 *
 * Includes two pre-computed columns rather than asking the engine to
 * evaluate a multi-column arithmetic expression: "Total Price" (Quantity
 * * Unit Price - Discount) and "Delivery Days" (Delivery Date - Order
 * Date). A real uploaded workbook typically already has columns like
 * these as formulas, and SheetJS extraction already resolves formula
 * cells to their last-saved values (see spreadsheet.ts) before this
 * engine ever sees the grid — so a plain SUM/AVG measure over an
 * existing numeric column is the realistic shape, not a gap in the
 * engine. AnalyticalMeasure deliberately stays single-column
 * sum/avg/count/ratio (see analyticalPlan.ts's doc comment); this
 * fixture doesn't need a derived-expression measure type to answer the
 * benchmark.
 *
 * Every EXPECTED value below was computed by a separate plain-array-
 * reduce script (not executeAnalyticalPlan, not this engine) — see
 * executeAnalyticalPlan.acceptance.test.ts's doc comment. Same
 * discipline as salesExpensesWorkbook.ts.
 */

/**
 * Header names deliberately include spaces (e.g. "Order Date", not
 * "OrderDate") — columnAnalysis.ts's header regexes (DATE_HEADER,
 * CURRENCY_HEADER, CATEGORY_HEADER) match on \b word boundaries, which a
 * merged camelCase header doesn't cross; matching realistic human-typed
 * spreadsheet headers here is what makes the fixture actually exercise
 * date/category/currency detection the way a real upload would, not an
 * artifact of this fixture being hand-written.
 */
export const PRODUCT_SALES_HEADER = [
  'Order Date', 'Delivery Date', 'Region', 'Product', 'Store', 'Salesperson', 'Customer Type',
  'Quantity', 'Unit Price', 'Discount', 'Promotion', 'Returned', 'Shipping Cost', 'Payment',
  'Total Price', 'Delivery Days',
] as const

export const PRODUCT_SALES_DATA_ROWS: unknown[][] = [
  ['2023-01-05', '2023-01-09', 'North', 'Widget', 'Store1', 'Alice', 'Retail', 4, 25, 2, true, false, 5, 'Card', 98, 4],
  ['2023-02-10', '2023-02-12', 'North', 'Gadget', 'Store1', 'Alice', 'Wholesale', 10, 40, 0, false, false, 8, 'Cash', 400, 2],
  ['2023-03-15', '2023-03-20', 'South', 'Widget', 'Store2', 'Bob', 'Retail', 3, 25, 0, false, true, 5, 'Card', 75, 5],
  ['2023-04-02', '2023-04-05', 'South', 'Gadget', 'Store2', 'Bob', 'Retail', 6, 40, 4, true, false, 8, 'Card', 236, 3],
  ['2023-05-18', '2023-05-21', 'North', 'Widget', 'Store1', 'Carol', 'Wholesale', 8, 25, 0, false, false, 5, 'Cash', 200, 3],
  ['2023-06-22', '2023-06-24', 'South', 'Gadget', 'Store2', 'Carol', 'Retail', 5, 40, 0, false, true, 8, 'Card', 200, 2],
  ['2023-07-09', '2023-07-14', 'North', 'Widget', 'Store1', 'Alice', 'Retail', 7, 25, 2.5, true, false, 5, 'Cash', 172.5, 5],
  ['2023-08-14', '2023-08-16', 'South', 'Widget', 'Store2', 'Bob', 'Wholesale', 12, 25, 0, false, false, 5, 'Card', 300, 2],
  ['2023-09-01', '2023-09-04', 'North', 'Gadget', 'Store1', 'Carol', 'Retail', 4, 40, 0, false, false, 8, 'Cash', 160, 3],
  ['2023-10-11', '2023-10-13', 'South', 'Gadget', 'Store2', 'Alice', 'Retail', 9, 40, 4, true, true, 8, 'Card', 356, 2],
  ['2023-11-23', '2023-11-28', 'North', 'Widget', 'Store1', 'Bob', 'Wholesale', 6, 25, 0, false, false, 5, 'Cash', 150, 5],
  ['2023-12-05', '2023-12-08', 'South', 'Widget', 'Store2', 'Carol', 'Retail', 5, 25, 0, false, false, 5, 'Card', 125, 3],

  ['2024-01-07', '2024-01-11', 'North', 'Gadget', 'Store1', 'Alice', 'Retail', 11, 40, 0, false, false, 8, 'Card', 440, 4],
  ['2024-02-13', '2024-02-15', 'South', 'Widget', 'Store2', 'Bob', 'Retail', 4, 25, 2, true, false, 5, 'Cash', 98, 2],
  ['2024-03-19', '2024-03-25', 'North', 'Widget', 'Store1', 'Carol', 'Wholesale', 9, 25, 0, false, true, 5, 'Card', 225, 6],
  ['2024-04-08', '2024-04-10', 'South', 'Gadget', 'Store2', 'Bob', 'Retail', 7, 40, 0, false, false, 8, 'Card', 280, 2],
  ['2024-05-16', '2024-05-19', 'North', 'Gadget', 'Store1', 'Alice', 'Wholesale', 13, 40, 5, true, false, 8, 'Cash', 515, 3],
  ['2024-06-20', '2024-06-22', 'South', 'Widget', 'Store2', 'Carol', 'Retail', 6, 25, 0, false, true, 5, 'Card', 150, 2],
  ['2024-07-03', '2024-07-08', 'North', 'Widget', 'Store1', 'Bob', 'Retail', 8, 25, 0, false, false, 5, 'Card', 200, 5],
  ['2024-08-27', '2024-08-29', 'South', 'Gadget', 'Store2', 'Alice', 'Retail', 10, 40, 4, true, false, 8, 'Cash', 396, 2],
  ['2024-09-15', '2024-09-18', 'North', 'Gadget', 'Store1', 'Carol', 'Retail', 5, 40, 0, false, true, 8, 'Card', 200, 3],
  ['2024-10-10', '2024-10-12', 'South', 'Widget', 'Store2', 'Bob', 'Wholesale', 14, 25, 0, false, false, 5, 'Card', 350, 2],
  ['2024-11-05', '2024-11-10', 'North', 'Widget', 'Store1', 'Alice', 'Retail', 6, 25, 2, true, false, 5, 'Cash', 148, 5],
  ['2024-12-19', '2024-12-21', 'South', 'Gadget', 'Store2', 'Carol', 'Retail', 9, 40, 0, false, false, 8, 'Card', 360, 2],

  ['2025-01-08', '2025-01-12', 'North', 'Widget', 'Store1', 'Bob', 'Retail', 5, 25, 0, false, true, 5, 'Card', 125, 4],
  ['2025-02-14', '2025-02-16', 'South', 'Gadget', 'Store2', 'Alice', 'Wholesale', 10, 40, 0, false, false, 8, 'Cash', 400, 2],
  ['2025-03-22', '2025-03-27', 'North', 'Gadget', 'Store1', 'Carol', 'Retail', 7, 40, 4, true, false, 8, 'Card', 276, 5],
  ['2025-04-11', '2025-04-13', 'South', 'Widget', 'Store2', 'Bob', 'Retail', 8, 25, 0, false, false, 5, 'Card', 200, 2],
  ['2025-05-06', '2025-05-08', 'North', 'Widget', 'Store1', 'Alice', 'Wholesale', 12, 25, 0, false, true, 5, 'Cash', 300, 2],
  ['2025-06-17', '2025-06-19', 'South', 'Gadget', 'Store2', 'Carol', 'Retail', 6, 40, 0, false, false, 8, 'Card', 240, 2],
]

export const PRODUCT_SALES_ROWS: unknown[][] = [Array.from(PRODUCT_SALES_HEADER), ...PRODUCT_SALES_DATA_ROWS]

export const EXPECTED = {
  totalSalesBySalesperson: { Alice: 3225.5, Bob: 2014, Carol: 2136 },
  topSalespersonBySales: 'Alice',
  returnRateByRegion: { North: 4 / 15, South: 4 / 15 },
  returnRateByProduct: { Widget: 5 / 16, Gadget: 3 / 14 },
  salesByCustomerType: { Retail: 4535.5, Wholesale: 2840 },
  salesByYear: { '2023': 2472.5, '2024': 3362, '2025': 1541 },
  salesByMonthJan2023: 98,
  salesByRegionMonthNorth202301: 98,
  avgDeliveryDaysByStore: { Store1: 3.933333333333333, Store2: 2.3333333333333335 },
  paymentSharePercent: { Card: (19 / 30) * 100, Cash: (11 / 30) * 100 },
  discountRateByProduct: { Widget: 0.02125, Gadget: 0.0375 },
  avgOrderValuePromoted: 255.05555555555554,
  avgOrderValueNonPromoted: 241.9047619047619,
  h1_2025_rowCount: 6,
  h1_2025_revenueByStore: { Store1: 701, Store2: 840 },
  returnRateBySalesperson: { Alice: 0.2, Bob: 0.2, Carol: 0.4 },
  totalRowCount: 30,
} as const
