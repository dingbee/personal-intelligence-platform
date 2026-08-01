/**
 * UX-14.4 Phase 1 — Artifact Intelligence Foundation. The full kind list
 * from the UX-14.4 blueprint (`docs/ux-14.4-knowledge-artifact-architecture.md`).
 * All eight kinds persist as a `Note` for now (see that doc's §2 — text-shaped
 * kinds already have a full home in `notes`; structured-data kinds get a
 * `payload`-bearing table only once real export/generation work needs one).
 * This registry exists so every surface that shows "what kind of thing is
 * this" reads from one place instead of re-deriving labels ad hoc.
 */
export type ArtifactKind =
  | 'note'
  | 'briefing'
  | 'formula'
  | 'spreadsheet'
  | 'chart'
  | 'report'
  | 'template'
  | 'knowledge_card'

export interface ArtifactKindDefinition {
  kind: ArtifactKind
  label: string
  description: string
}

export const ARTIFACT_KIND_DEFINITIONS: Record<ArtifactKind, ArtifactKindDefinition> = {
  note: { kind: 'note', label: 'Note', description: 'A general written note.' },
  briefing: { kind: 'briefing', label: 'Briefing', description: 'An executive summary, proposal, or report-style writeup.' },
  knowledge_card: { kind: 'knowledge_card', label: 'Knowledge Card', description: 'A compact, shareable insight with a confidence level and sources.' },
  report: { kind: 'report', label: 'Report', description: 'A multi-section structured document.' },
  template: { kind: 'template', label: 'Template', description: 'A reusable checklist or process.' },
  formula: { kind: 'formula', label: 'Formula Template', description: 'A reusable calculation with named inputs.' },
  spreadsheet: { kind: 'spreadsheet', label: 'Spreadsheet Model', description: 'Tabular data, optionally with formulas.' },
  chart: { kind: 'chart', label: 'Chart', description: 'A data visualization derived from tabular data.' },
}

/** Save As menu order — most common/general first, most structured last. */
export const ARTIFACT_KIND_ORDER: ArtifactKind[] = [
  'note',
  'briefing',
  'knowledge_card',
  'report',
  'template',
  'formula',
  'spreadsheet',
  'chart',
]

export function isArtifactKind(value: unknown): value is ArtifactKind {
  return typeof value === 'string' && value in ARTIFACT_KIND_DEFINITIONS
}
