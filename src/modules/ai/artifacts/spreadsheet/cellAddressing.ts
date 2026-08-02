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
