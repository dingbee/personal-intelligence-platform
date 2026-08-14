import type { ColumnAnalysis, CellValue } from '@/modules/processing/spreadsheet/types'
import type { StructuredDataset } from '@/modules/data-intelligence/api/structuredDatasets'
import { parseDateValue, parseNumericValue } from '@/modules/processing/spreadsheet/cellParsing'
import type {
  AnalyticalDimension,
  AnalyticalFilter,
  AnalyticalMeasure,
  AnalyticalPlan,
  AnalyticalResult,
  AnalyticalResultRow,
  AnalyticalValidationError,
  MeasureAggregation,
  RatioTerm,
} from '@/modules/data-intelligence/analyticalPlan'

/**
 * Data Intelligence Foundation — the deterministic execution engine.
 * "question → analytical plan → deterministic execution → validation/
 * provenance → interpretation": this file is the middle step. It never
 * calls an AI provider and never sees a natural-language question — it
 * takes a dataset and a structured plan and returns structured numbers,
 * or a structured reason it couldn't. The LLM is never the calculator.
 */

const ALLOWED_AGGREGATIONS: MeasureAggregation[] = ['sum', 'avg', 'count', 'count_distinct', 'min', 'max', 'ratio']
const NUMERIC_TYPES = new Set(['number', 'currency'])

function buildColumnsByName(dataset: StructuredDataset): Map<string, ColumnAnalysis> {
  return new Map(dataset.columns.map((c) => [c.name, c]))
}

function validatePlan(dataset: StructuredDataset, plan: AnalyticalPlan): AnalyticalValidationError | null {
  const columnsByName = buildColumnsByName(dataset)

  const checkColumnExists = (name: string): AnalyticalValidationError | null =>
    columnsByName.has(name) ? null : { code: 'unknown_column', message: `Column "${name}" does not exist in this dataset.`, column: name }

  for (const filter of plan.filters ?? []) {
    const err = checkColumnExists(filter.column)
    if (err) return err
    const column = columnsByName.get(filter.column)!
    if (['gt', 'gte', 'lt', 'lte'].includes(filter.op) && column.dataType !== 'date' && !NUMERIC_TYPES.has(column.dataType)) {
      return { code: 'incompatible_type', message: `"${filter.column}" is not a numeric or date column; cannot use "${filter.op}".`, column: filter.column }
    }
  }

  for (const dim of plan.dimensions ?? []) {
    const err = checkColumnExists(dim.column)
    if (err) return err
    if (dim.dateTrunc && columnsByName.get(dim.column)!.dataType !== 'date') {
      return { code: 'incompatible_type', message: `"${dim.column}" is not a date column; cannot group it by ${dim.dateTrunc}.`, column: dim.column }
    }
  }

  if (!plan.measures || plan.measures.length === 0) {
    return { code: 'ambiguous_measure', message: 'The plan must include at least one measure.' }
  }

  const seenAs = new Set<string>()
  for (const measure of plan.measures) {
    if (!measure.as) return { code: 'ambiguous_measure', message: 'Every measure must have an output name ("as").' }
    if (seenAs.has(measure.as)) return { code: 'ambiguous_measure', message: `Duplicate measure output name "${measure.as}".` }
    seenAs.add(measure.as)

    if (!ALLOWED_AGGREGATIONS.includes(measure.aggregation)) {
      return { code: 'unsupported_aggregation', message: `"${measure.aggregation}" is not a supported aggregation.` }
    }
    for (const f of measure.filters ?? []) {
      const err = checkColumnExists(f.column)
      if (err) return err
    }

    if (measure.aggregation === 'ratio') {
      if (!measure.ratio) return { code: 'ambiguous_measure', message: `Measure "${measure.as}" uses "ratio" but has no numerator/denominator.` }
      for (const term of [measure.ratio.numerator, measure.ratio.denominator]) {
        if (term.aggregation === 'sum') {
          if (!term.column) return { code: 'ambiguous_measure', message: 'A ratio term with aggregation "sum" must name a column.' }
          const err = checkColumnExists(term.column)
          if (err) return err
          const col = columnsByName.get(term.column)!
          if (!NUMERIC_TYPES.has(col.dataType)) {
            return { code: 'incompatible_type', message: `"${term.column}" is not numeric; cannot sum it.`, column: term.column }
          }
        }
        for (const f of term.filters ?? []) {
          const err = checkColumnExists(f.column)
          if (err) return err
        }
      }
      continue
    }

    if (measure.aggregation === 'count') continue

    if (!measure.column) {
      return { code: 'ambiguous_measure', message: `Measure "${measure.as}" (${measure.aggregation}) must name a column.` }
    }
    const err = checkColumnExists(measure.column)
    if (err) return err
    const column = columnsByName.get(measure.column)!
    if (measure.aggregation !== 'count_distinct' && !NUMERIC_TYPES.has(column.dataType)) {
      return { code: 'incompatible_type', message: `"${measure.column}" is not numeric; cannot ${measure.aggregation} it.`, column: measure.column }
    }
  }

  if (plan.sort) {
    const dimNames = new Set((plan.dimensions ?? []).map((d) => d.column))
    const measureNames = new Set(plan.measures.map((m) => m.as))
    if (!dimNames.has(plan.sort.by) && !measureNames.has(plan.sort.by)) {
      return { code: 'unknown_column', message: `Cannot sort by "${plan.sort.by}" — it is not a dimension or measure in this plan.`, column: plan.sort.by }
    }
  }

  return null
}

function valuesEqual(cellRaw: CellValue, target: CellValue, column: ColumnAnalysis): boolean {
  if (typeof cellRaw === 'boolean' || typeof target === 'boolean') return Boolean(cellRaw) === Boolean(target)
  if (column.dataType === 'date') {
    const a = parseDateValue(cellRaw)
    const b = parseDateValue(target)
    return a !== null && a === b
  }
  if (NUMERIC_TYPES.has(column.dataType)) {
    const a = parseNumericValue(cellRaw)
    const b = typeof target === 'number' ? target : parseNumericValue(target)
    return a !== null && b !== null && a === b
  }
  return String(cellRaw ?? '').trim().toLowerCase() === String(target ?? '').trim().toLowerCase()
}

function compareOrdered(cellRaw: CellValue, target: CellValue, column: ColumnAnalysis): number | null {
  if (column.dataType === 'date') {
    const a = parseDateValue(cellRaw)
    const b = parseDateValue(target)
    if (a === null || b === null) return null
    return a < b ? -1 : a > b ? 1 : 0
  }
  const a = parseNumericValue(cellRaw)
  const b = typeof target === 'number' ? target : parseNumericValue(target)
  if (a === null || b === null) return null
  return a < b ? -1 : a > b ? 1 : 0
}

function rowMatchesFilter(row: CellValue[], filter: AnalyticalFilter, columnsByName: Map<string, ColumnAnalysis>): boolean {
  const column = columnsByName.get(filter.column)!
  const cell = row[column.columnIndex] ?? null
  switch (filter.op) {
    case 'eq':
      return valuesEqual(cell, filter.value as CellValue, column)
    case 'neq':
      return !valuesEqual(cell, filter.value as CellValue, column)
    case 'gt': {
      const c = compareOrdered(cell, filter.value as CellValue, column)
      return c !== null && c > 0
    }
    case 'gte': {
      const c = compareOrdered(cell, filter.value as CellValue, column)
      return c !== null && c >= 0
    }
    case 'lt': {
      const c = compareOrdered(cell, filter.value as CellValue, column)
      return c !== null && c < 0
    }
    case 'lte': {
      const c = compareOrdered(cell, filter.value as CellValue, column)
      return c !== null && c <= 0
    }
    case 'in': {
      const values = Array.isArray(filter.value) ? filter.value : [filter.value]
      return values.some((v) => valuesEqual(cell, v, column))
    }
    case 'between': {
      const [min, max] = filter.value as CellValue[]
      const c1 = compareOrdered(cell, min ?? null, column)
      const c2 = compareOrdered(cell, max ?? null, column)
      return c1 !== null && c2 !== null && c1 >= 0 && c2 <= 0
    }
    default:
      return false
  }
}

function rowMatchesAll(row: CellValue[], filters: AnalyticalFilter[] | undefined, columnsByName: Map<string, ColumnAnalysis>): boolean {
  return !filters || filters.every((f) => rowMatchesFilter(row, f, columnsByName))
}

function dimensionValue(row: CellValue[], dim: AnalyticalDimension, columnsByName: Map<string, ColumnAnalysis>): CellValue {
  const column = columnsByName.get(dim.column)!
  const cell = row[column.columnIndex] ?? null
  if (dim.dateTrunc) {
    const iso = parseDateValue(cell)
    if (!iso) return null
    return dim.dateTrunc === 'year' ? iso.slice(0, 4) : iso.slice(0, 7)
  }
  return cell
}

function normalizeForDistinct(cell: CellValue): string {
  return `${typeof cell}:${String(cell)}`
}

function computeTermValue(rows: CellValue[][], term: RatioTerm, columnsByName: Map<string, ColumnAnalysis>): number | null {
  const scoped = term.filters ? rows.filter((row) => rowMatchesAll(row, term.filters, columnsByName)) : rows
  if (term.aggregation === 'count') return scoped.length
  const column = columnsByName.get(term.column!)!
  const values = scoped.map((row) => parseNumericValue(row[column.columnIndex])).filter((v): v is number => v !== null)
  return values.reduce((a, b) => a + b, 0)
}

function computeMeasure(rows: CellValue[][], measure: AnalyticalMeasure, columnsByName: Map<string, ColumnAnalysis>): number | null {
  if (measure.aggregation === 'ratio') {
    const numerator = computeTermValue(rows, measure.ratio!.numerator, columnsByName)
    const denominator = computeTermValue(rows, measure.ratio!.denominator, columnsByName)
    if (numerator === null || denominator === null || denominator === 0) return null
    return numerator / denominator
  }

  const scoped = rows.filter((row) => rowMatchesAll(row, measure.filters, columnsByName))

  if (measure.aggregation === 'count') return scoped.length

  const column = columnsByName.get(measure.column!)!
  if (measure.aggregation === 'count_distinct') {
    return new Set(scoped.map((row) => normalizeForDistinct(row[column.columnIndex] ?? null))).size
  }

  const values = scoped.map((row) => parseNumericValue(row[column.columnIndex])).filter((v): v is number => v !== null)
  if (measure.aggregation === 'sum') return values.reduce((a, b) => a + b, 0)
  if (values.length === 0) return null
  if (measure.aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (measure.aggregation === 'min') return Math.min(...values)
  return Math.max(...values)
}

function compareForSort(a: CellValue | number | null | undefined, b: CellValue | number | null | undefined): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1
  if (b === null || b === undefined) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/**
 * Executes an already-parsed AnalyticalPlan against a persisted
 * StructuredDataset, purely in memory — never generates SQL, never
 * touches the network. Validates first (see validatePlan above); an
 * invalid plan returns a structured `status:'error'` describing exactly
 * what's wrong, never a silent substitution or a best-effort guess.
 */
export function executeAnalyticalPlan(dataset: StructuredDataset, plan: AnalyticalPlan): AnalyticalResult {
  const validationError = validatePlan(dataset, plan)
  if (validationError) return { status: 'error', plan, error: validationError }

  const columnsByName = buildColumnsByName(dataset)
  const filtered = plan.filters && plan.filters.length > 0 ? dataset.rows.filter((row) => rowMatchesAll(row, plan.filters, columnsByName)) : dataset.rows

  const dimensions = plan.dimensions ?? []
  const groups = new Map<string, { dimensionValues: Record<string, CellValue>; rows: CellValue[][] }>()
  for (const row of filtered) {
    const dimensionValues: Record<string, CellValue> = {}
    for (const dim of dimensions) dimensionValues[dim.column] = dimensionValue(row, dim, columnsByName)
    const key = JSON.stringify(dimensions.map((d) => dimensionValues[d.column]))
    const existing = groups.get(key)
    if (existing) existing.rows.push(row)
    else groups.set(key, { dimensionValues, rows: [row] })
  }
  if (groups.size === 0 && dimensions.length === 0) {
    groups.set('[]', { dimensionValues: {}, rows: [] })
  }

  let resultRows: AnalyticalResultRow[] = Array.from(groups.values()).map((group) => ({
    dimensions: group.dimensionValues,
    measures: Object.fromEntries(plan.measures.map((m) => [m.as, computeMeasure(group.rows, m, columnsByName)])),
  }))

  if (plan.sort) {
    const { by, direction } = plan.sort
    const sorted = [...resultRows].sort((a, b) => compareForSort(a.measures[by] ?? a.dimensions[by], b.measures[by] ?? b.dimensions[by]))
    resultRows = direction === 'asc' ? sorted : sorted.reverse()
  }
  if (typeof plan.limit === 'number') resultRows = resultRows.slice(0, plan.limit)

  return {
    status: 'ok',
    plan,
    rows: resultRows,
    provenance: {
      documentId: dataset.documentId,
      sheetName: dataset.sheetName,
      sheetIndex: dataset.sheetIndex,
      totalRowsInDataset: dataset.rowCount,
      rowsMatchedAfterFilters: filtered.length,
    },
  }
}
