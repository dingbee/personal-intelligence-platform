/**
 * UX-14.4.1 — the formula-content safety allowlist flagged (but explicitly
 * deferred) by the Path B architecture discovery
 * (`docs/ux-14.4-path-b-generation-discovery.md`, "Formula injection (the
 * most important finding of this discovery)") and by the engineering
 * blueprint's Artifact Intelligence section ("A formula-content safety
 * allowlist must land before any LLM-authored formula reaches the
 * compiler").
 *
 * This module is a standalone, self-contained foundation: it is not called
 * from `compileSpreadsheetSpecification.ts`, `validateSpreadsheetSpecification.ts`,
 * `parseMarkdownTableToArtifact.ts`, or `buildSpreadsheetWorkbook.ts`. Wiring
 * it into the live pipeline is Path B work (an actual AI producer needs to
 * exist first) and is explicitly out of scope for this milestone — see the
 * UX-14 docs for the recorded sequencing decision.
 *
 * Scope: validates a *resolved* formula expression — the same bare,
 * no-leading-"=" text `SpreadsheetCell.formula` already stores and
 * `buildSpreadsheetWorkbook` already writes into a real `.f` field (e.g.
 * "A1-B1", "SUM(A2,A3,A4)") — not the pre-resolution `{{ColumnName}}`
 * placeholder syntax, which `validateSpreadsheetSpecification.ts` already
 * checks for reference integrity. This is a content-safety check, layered
 * on top of, not a replacement for, that structural validation.
 *
 * Two independent checks, both must pass:
 * 1. Character allowlist — every character must be a digit, letter, or one
 *    of the arithmetic/comparison/grouping symbols a legitimate formula
 *    needs. This alone rejects the DDE-style and lookup/webservice-style
 *    payloads named in the Path B discovery (`cmd|'/c ...'!A1`,
 *    `HYPERLINK("...")`) since they all require characters outside this set
 *    (`|`, `'`, `!`, `"`, `:`, `;`, `@`, `#`, `[`, `]`).
 * 2. Function/identifier allowlist — every run of letters is classified as
 *    either a valid cell reference (e.g. "A1", "$B$12") or, if immediately
 *    followed by "(", a function call that must be in the fixed safe set
 *    (SUM/AVERAGE/MIN/MAX/COUNT — the exact set named in the Path B
 *    discovery). Anything else (e.g. "WEBSERVICE", "IMPORTXML", a bare word
 *    that's neither) is rejected even though its characters are otherwise
 *    allowed.
 */

export type SpreadsheetFormulaSafetyViolationCode = 'DISALLOWED_CHARACTER' | 'DISALLOWED_FUNCTION' | 'DISALLOWED_IDENTIFIER'

export interface SpreadsheetFormulaSafetyViolation {
  code: SpreadsheetFormulaSafetyViolationCode
  detail: string
  message: string
}

export interface SpreadsheetFormulaSafetyResult {
  safe: boolean
  violations: SpreadsheetFormulaSafetyViolation[]
}

/** The exact "fixed set of safe functions" named in the Path B architecture discovery. Deliberately small; extend only with an equally-deliberate review, not by convenience. */
export const FORMULA_SAFETY_ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'])

/** Digits, letters, arithmetic/comparison operators, grouping, decimal point, argument separator, absolute-reference "$", and whitespace — nothing else. */
const ALLOWED_CHARACTERS_PATTERN = /^[A-Za-z0-9.,()+\-*/^%<>=$\s]*$/

const IDENTIFIER_PATTERN = /[A-Za-z]+/g
/** A letter run is a valid cell-reference prefix when 1-3 letters (Excel column letters never exceed 3) are immediately followed by an optional "$" and at least one digit. */
const REFERENCE_ROW_SUFFIX_PATTERN = /^\$?[0-9]+/

function findDisallowedCharacters(expression: string): string[] {
  if (ALLOWED_CHARACTERS_PATTERN.test(expression)) return []
  const disallowed = new Set<string>()
  for (const char of expression) {
    if (!/^[A-Za-z0-9.,()+\-*/^%<>=$\s]$/.test(char)) disallowed.add(char)
  }
  return [...disallowed]
}

/**
 * Classifies every letter-run in `expression` as a safe cell reference, a
 * safe function call, or a violation. A letter-run followed (ignoring
 * whitespace) by "(" is treated as a function call; otherwise it must
 * resolve to a valid `$A$1`-style cell reference including its trailing
 * digits.
 */
function findIdentifierViolations(expression: string): SpreadsheetFormulaSafetyViolation[] {
  const violations: SpreadsheetFormulaSafetyViolation[] = []

  for (const match of expression.matchAll(IDENTIFIER_PATTERN)) {
    const identifier = match[0]
    const rest = expression.slice(match.index! + identifier.length)
    const isFunctionCall = /^\s*\(/.test(rest)

    if (isFunctionCall) {
      const name = identifier.toUpperCase()
      if (!FORMULA_SAFETY_ALLOWED_FUNCTIONS.has(name)) {
        violations.push({
          code: 'DISALLOWED_FUNCTION',
          detail: identifier,
          message: `Function "${identifier}" is not in the allowed set (${[...FORMULA_SAFETY_ALLOWED_FUNCTIONS].join(', ')}).`,
        })
      }
      continue
    }

    // Not a function call — must be the letter portion of a real cell
    // reference: at most 3 letters (Excel's max column-letter length),
    // immediately followed by an optional "$" and at least one digit.
    const isCellReference = identifier.length <= 3 && REFERENCE_ROW_SUFFIX_PATTERN.test(rest)
    if (!isCellReference) {
      violations.push({
        code: 'DISALLOWED_IDENTIFIER',
        detail: identifier,
        message: `"${identifier}" is neither a cell reference nor an allowed function call.`,
      })
    }
  }

  return violations
}

/**
 * Validates a resolved formula expression against the formula-content
 * safety allowlist. Pure, deterministic, no I/O. Does not evaluate or
 * transform the expression — only classifies it as safe or unsafe.
 */
export function validateFormulaSafety(expression: string): SpreadsheetFormulaSafetyResult {
  const violations: SpreadsheetFormulaSafetyViolation[] = []

  const disallowedCharacters = findDisallowedCharacters(expression)
  for (const char of disallowedCharacters) {
    violations.push({
      code: 'DISALLOWED_CHARACTER',
      detail: char,
      message: `Character "${char}" is not allowed in a formula expression.`,
    })
  }

  // Identifier classification only makes sense once the character set is
  // already clean — a stray "!" or "|" earlier in the string can otherwise
  // produce misleading identifier-boundary matches.
  if (disallowedCharacters.length === 0) {
    violations.push(...findIdentifierViolations(expression))
  }

  return { safe: violations.length === 0, violations }
}
