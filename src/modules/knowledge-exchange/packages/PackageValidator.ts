/**
 * UX-14.5.9 — the generic validation contract every package type's
 * validator implements (`notes/validateNotePackage.ts` today; a future
 * Documents/Collections package type plugs into this same shape rather
 * than inventing its own result convention).
 */
export interface PackageValidationIssue {
  code: 'malformed_json' | 'unsupported_version' | 'future_version' | 'invalid_schema' | 'missing_field'
  message: string
}

export type PackageValidationResult<TPackage> =
  | { valid: true; package: TPackage }
  | { valid: false; issues: PackageValidationIssue[] }

/** One validator per package type. `validate` never throws — an invalid package is a normal, expected outcome (a hand-edited file, a future app version, a corrupted download), not an exceptional one. */
export interface PackageValidator<TPackage> {
  validate(input: unknown): PackageValidationResult<TPackage>
}
