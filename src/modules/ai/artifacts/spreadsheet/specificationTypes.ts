/**
 * UX-14.4 Phase 3 — the `SpreadsheetSpecification` contract approved in
 * `docs/ux-14.4-spreadsheet-specification-discovery.md` (commit 0f8f26e),
 * implemented per that document's Investigation 1 & 2 conclusion: a
 * row/column-oriented shape, index-aligned, with no A1 addresses anywhere
 * — address assignment is entirely `compileSpreadsheetSpecification`'s
 * job (see that file), never something a producer has to get right.
 *
 * Column-level `type` refines the discovery doc's reserved-formatting
 * hint to the exact six categories this milestone's brief specifies
 * (`currency`/`percent`/`integer`/`decimal`/`date`/`text`, superseding
 * the discovery draft's rougher `'number' | 'percentage'`). Still inert:
 * nothing in this file or `compileSpreadsheetSpecification.ts` maps it to
 * an Excel number format — it only has to survive compilation into
 * `SpreadsheetArtifactData.sheets[].columnFormats`, per that document's
 * own "formatting metadata must survive compilation but remain inert
 * until a later milestone" framing.
 */
export type SpreadsheetColumnType = 'currency' | 'percent' | 'integer' | 'decimal' | 'date' | 'text'

export interface SpreadsheetSpecificationColumn {
  name: string
  /** Reserved for a future number-format mapping — not read by buildSpreadsheetWorkbook. */
  type?: SpreadsheetColumnType
}

/** Index-aligned to the sheet's `columns` — the one invariant validation enforces (no per-value address, nothing to miscount). */
export interface SpreadsheetSpecificationRow {
  values: (string | number | null)[]
}

/**
 * Reserved shape, narrowly scoped per instruction: `expression` is bare
 * text (an optional leading "=" is accepted and stripped at compile time,
 * matching `SpreadsheetCell.formula`'s existing "no leading =" contract)
 * substituted only for `{{ColumnName}}` placeholders resolved to a
 * same-row A1 reference. Deliberately does NOT support ranges,
 * cross-row references, sheet references, named ranges, or function-aware
 * interpretation — `compileSpreadsheetSpecification` treats everything
 * outside a placeholder as opaque literal text, never parsed or
 * evaluated. No formula-content safety allowlist exists yet either (see
 * the Path B architecture discovery's formula-injection risk finding) —
 * that is out of scope until real generation exists to validate against.
 */
export interface SpreadsheetSpecificationFormula {
  /** Must name a real column in the same sheet. */
  column: string
  /** 1-indexed into `rows` — the Nth data row, never a raw sheet row number. */
  row: number
  expression: string
}

export interface SpreadsheetSpecificationSheet {
  name: string
  columns: SpreadsheetSpecificationColumn[]
  rows: SpreadsheetSpecificationRow[]
  formulas?: SpreadsheetSpecificationFormula[]
}

export type SpreadsheetSpecificationKind = 'template' | 'data_model'

export interface SpreadsheetSpecification {
  title: string
  /** Intent only — recording this does not by itself verify a 'data_model' spec's values trace to real retrieved data. That check belongs to a future orchestrator. */
  kind: SpreadsheetSpecificationKind
  sheets: SpreadsheetSpecificationSheet[]
}
