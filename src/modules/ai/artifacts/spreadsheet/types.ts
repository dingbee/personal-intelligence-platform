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
}

export interface SpreadsheetArtifactData {
  sheets: SpreadsheetSheet[]
}
