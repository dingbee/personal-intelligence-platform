/**
 * UX-14.4.1 — extracted from `parseMarkdownTableToArtifact.ts` and
 * `compileSpreadsheetSpecification.ts`, which both defined an identical
 * `columnLetter` (flagged as a zero-risk refactor opportunity in the
 * Phase 3 implementation record and the architecture consolidation doc's
 * "Future Opportunities" section — this is that flag acted on). Both
 * producers of `SpreadsheetArtifactData` now share one address-computation
 * implementation instead of two independently-maintained copies.
 */

/** A1-style column letters for 0-indexed column numbers: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index: number): string {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

const CELL_ADDRESS_PATTERN = /^([A-Za-z]+)([0-9]+)$/

/**
 * UX-14.4.2 — the inverse of `columnLetter`, decoding an "A1"-style
 * address into 0-indexed `{row, col}`. Added specifically so
 * `renderSpreadsheetArtifactMarkdown.ts` can lay out a preview grid
 * without importing `xlsx` for `XLSX.utils.decode_cell` — `sheetToGrid.ts`
 * already does that decoding, but it lives behind the `xlsx` import, and
 * this function's caller is reachable from an eagerly-registered
 * Workspace Action (`generateSpreadsheetArtifactAction.ts`, imported from
 * `App.tsx`), not from a lazy-loaded reader page like `sheetToGrid.ts`'s
 * existing caller is. Pulling `xlsx` into that eager path regressed the
 * main bundle by ~430KB in this milestone's first build — caught by
 * `verify:bundle`, fixed by never needing `xlsx` here at all.
 */
export function decodeCellAddress(address: string): { row: number; col: number } {
  const match = CELL_ADDRESS_PATTERN.exec(address)
  if (!match) throw new Error(`Not a valid cell address: "${address}"`)
  const [, letters, digits] = match

  let col = 0
  for (const char of letters!.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64)
  }

  return { row: Number(digits) - 1, col: col - 1 }
}
