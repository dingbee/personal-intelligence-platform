import { describe, expect, it } from 'vitest'
import { analyticalResultToProvenance } from '@/shared/provenance/adapters/dataIntelligenceAdapter'
import { executeAnalyticalPlan } from '@/modules/data-intelligence/executeAnalyticalPlan'
import { analyzeSheet } from '@/modules/processing/spreadsheet/workbookAnalysis'
import { PRODUCT_SALES_DATA_ROWS, PRODUCT_SALES_ROWS } from '@/modules/data-intelligence/__fixtures__/productSalesWorkbook'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import type { CellValue } from '@/modules/processing/spreadsheet/types'

function buildDataset(): StructuredDataset {
  const analysis = analyzeSheet(PRODUCT_SALES_ROWS, 0, 'Sales')
  return {
    id: 'dataset-1',
    documentId: 'benchmark-document',
    userId: 'user-1',
    workspaceId: 'workspace-1',
    sheetIndex: 0,
    sheetName: 'Sales',
    columns: analysis.columns,
    rows: PRODUCT_SALES_DATA_ROWS as CellValue[][],
    rowCount: PRODUCT_SALES_DATA_ROWS.length,
    columnCount: analysis.columns.length,
  }
}

describe('analyticalResultToProvenance', () => {
  it('maps a real, deterministically-computed AnalyticalResult into evidence + a calculation derivation', () => {
    const dataset = buildDataset()
    const result = executeAnalyticalPlan(dataset, {
      datasetId: dataset.id,
      dimensions: [{ column: 'Region' }],
      measures: [{ as: 'total', aggregation: 'sum', column: 'Total Price' }],
    })

    const chain = analyticalResultToProvenance(result)
    expect(chain).not.toBeNull()
    expect(chain!.evidence.source).toEqual({ type: 'dataset', id: 'benchmark-document', title: 'Sales' })
    expect(chain!.evidence.location).toEqual({ kind: 'rows', sheetName: 'Sales', sheetIndex: 0, rowCount: 30 })
    expect(chain!.derivation.kind).toBe('calculation')
    expect(chain!.derivation.evidenceIds).toEqual([chain!.evidence.id])
    expect(chain!.derivation.statement).toContain('30 of 30 rows')
    expect(chain!.derivation.method).toContain('total = sum(Total Price)')
  })

  it('returns null for a failed AnalyticalResult — a validation error contributes no evidence, never a fabricated one', () => {
    const dataset = buildDataset()
    const result = executeAnalyticalPlan(dataset, {
      datasetId: dataset.id,
      measures: [{ as: 'x', aggregation: 'sum', column: 'Not A Real Column' }],
    })
    expect(result.status).toBe('error')
    expect(analyticalResultToProvenance(result)).toBeNull()
  })
})
