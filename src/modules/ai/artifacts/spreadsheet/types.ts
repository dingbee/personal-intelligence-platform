import type { SpreadsheetColumnType } from '@/modules/ai/artifacts/spreadsheet/specificationTypes'

/**
 * UX-14.4 Phase 2 (Path A) — the schema designed in
 * `docs/ux-14.4-phase2-spreadsheet-artifact-discovery.md` §2, implemented
 * verbatim. Plain JSON only (no Date objects, no functions), same
 * convention `SheetAnalysis` (`processing/spreadsheet/types.ts`) already
 * documents for the read-side equivalent — this is persisted into
 * `Note.generation_metadata.artifactData`, a jsonb column.
 */
export interface SpreadsheetCell {
  /** A1-style address, e.g. "B2". */
  cell: string
  value?: string | number | null
  /** Bare formula text, no leading "=". Never evaluated client-side — see the discovery doc's §2 rationale. */
  formula?: string | null
}

export interface SpreadsheetSheet {
  name: string
  /** Header labels, for preview rendering only — the workbook builder reads `cells` as the single source of truth, so this never needs to stay in sync with cell contents to remain safe. */
  columns?: string[]
  cells: SpreadsheetCell[]
  /**
   * UX-14.4 Phase 3 — index-aligned to `columns`, carrying the format hint
   * a `SpreadsheetSpecification` column declared through compilation.
   * Purely additive: `buildSpreadsheetWorkbook` does not read this field,
   * so nothing about workbook generation changes by its presence — it
   * exists only so formatting metadata survives compilation into this
   * type rather than being silently dropped, per the discovery doc's
   * "inert until a later milestone" framing. Undefined for every sheet
   * produced by `parseMarkdownTableToArtifact` (Path A never sets it).
   */
  columnFormats?: (SpreadsheetColumnType | undefined)[]
}

export interface SpreadsheetArtifactData {
  sheets: SpreadsheetSheet[]
}
