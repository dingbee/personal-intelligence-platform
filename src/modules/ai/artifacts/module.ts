import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/**
 * UX-14.4.2 — registers the `generate-spreadsheet-artifact` capability,
 * following the exact `registerPlatformModule` pattern
 * `knowledge-intelligence/module.ts` already uses for `generate-briefing`.
 * A dedicated module rather than folding this into knowledge-intelligence:
 * this capability belongs to the Artifact Intelligence track (UX-14.4),
 * not the concept/entity knowledge graph.
 *
 * The prompt instructs the model to output ONLY a JSON object matching
 * `SpreadsheetSpecification` (see specificationTypes.ts) — never raw XLSX,
 * never `SpreadsheetArtifactData` directly. That JSON is untrusted input:
 * `generateSpreadsheetArtifactAction.ts` runs it through
 * `validateSpreadsheetSpecification` and, on every compiled formula,
 * `validateFormulaSafety` before it ever reaches the workbook export path.
 * Formulas may only use arithmetic and the five allowed functions
 * (SUM/AVERAGE/MIN/MAX/COUNT) over same-row `{{ColumnName}}` placeholders
 * — spelled out in the prompt itself as defense in depth, not as a
 * substitute for the real validation that runs regardless of what the
 * model actually returns.
 *
 * Imported once, for its side effect, from app/App.tsx alongside
 * coreModule/knowledge-intelligence's module.ts.
 */
registerPlatformModule({
  id: 'artifact-intelligence',
  name: 'Artifact Intelligence',
  capabilities: [
    {
      id: 'generate-spreadsheet-artifact',
      label: 'Generate Spreadsheet Artifact',
      description: 'Produce a structured spreadsheet specification (sheets, columns, rows, formulas) from a natural-language request.',
    },
  ],
  prompts: [
    {
      id: 'generate-spreadsheet-artifact@1.0',
      capabilityId: 'generate-spreadsheet-artifact',
      version: '1.0',
      active: true,
      template:
        'You design spreadsheets. Given the request below, respond with ONLY a JSON object — no markdown code ' +
        'fences, no commentary — shaped exactly like:\n' +
        '{"title": "short title", "kind": "template" or "data_model", "sheets": [{"name": "sheet name", ' +
        '"columns": [{"name": "column name", "type": "currency"|"percent"|"integer"|"decimal"|"date"|"text"}], ' +
        '"rows": [{"values": [<one value per column, in column order, string/number/null>]}], ' +
        '"formulas": [{"column": "exact column name", "row": <1-indexed data row number>, "expression": ' +
        '"arithmetic over {{ColumnName}} placeholders, e.g. {{Revenue}}-{{Expenses}}, or one of SUM/AVERAGE/' +
        'MIN/MAX/COUNT over placeholders, e.g. SUM({{Q1}},{{Q2}},{{Q3}},{{Q4}})"}]}]}\n\n' +
        'Use "kind": "data_model" only when the request supplies or clearly implies real figures to compute ' +
        'with; use "template" when you are illustrating structure with representative example values instead. ' +
        'Every formula must reference only column names declared in the same sheet, using {{ColumnName}} — ' +
        'never a raw cell address, never a range, never any function other than SUM, AVERAGE, MIN, MAX, or ' +
        'COUNT. "formulas" and per-column "type" are both optional — omit either when not needed. Keep sheets ' +
        'to a reasonable size (a handful of columns, at most a few dozen rows) unless the request specifically ' +
        'calls for more.\n\nRequest: {{request}}',
    },
  ],
})
