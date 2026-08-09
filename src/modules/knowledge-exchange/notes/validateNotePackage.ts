import {
  isFuturePackageVersion,
  isSupportedPackageVersion,
} from '@/modules/knowledge-exchange/packages/PackageVersion'
import type {
  PackageValidationIssue,
  PackageValidationResult,
  PackageValidator,
} from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

/**
 * Never trusts a package as pre-validated just because it came from this
 * app's own Export (per the discovery doc's §6 stage 5) — a hand-edited
 * file, or one from a different app version, gets exactly the same
 * scrutiny. Collects every issue found rather than stopping at the
 * first, so the import dialog's validation summary can show a complete
 * list in one pass instead of a frustrating fix-one-see-the-next loop.
 */
export function validateNotePackage(input: unknown): PackageValidationResult<NotePackage> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a note package — expected a JSON object.")] }
  }
  const pkg = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (typeof pkg.version !== 'number') {
    issues.push(issue('missing_field', 'Missing or invalid "version" field.'))
  } else if (isFuturePackageVersion(pkg.version)) {
    issues.push(
      issue(
        'future_version',
        `This package was exported by a newer version of ARRIYIA (package version ${pkg.version}) that this app can't import yet.`,
      ),
    )
  } else if (!isSupportedPackageVersion(pkg.version)) {
    issues.push(issue('unsupported_version', `Package version ${JSON.stringify(pkg.version)} is not supported.`))
  }

  if (typeof pkg.exportedAt !== 'string') issues.push(issue('missing_field', 'Missing "exportedAt" field.'))
  if (typeof pkg.sourceVersion !== 'string') issues.push(issue('missing_field', 'Missing "sourceVersion" field.'))

  if (typeof pkg.note !== 'object' || pkg.note === null || Array.isArray(pkg.note)) {
    issues.push(issue('missing_field', 'Missing "note" field.'))
    return { valid: false, issues }
  }

  const note = pkg.note as Record<string, unknown>
  if (typeof note.title !== 'string') issues.push(issue('missing_field', 'The note is missing a "title".'))
  if (typeof note.content !== 'string') issues.push(issue('missing_field', 'The note is missing "content".'))
  if (!Array.isArray(note.tags) || !note.tags.every((tag) => typeof tag === 'string')) {
    issues.push(issue('invalid_schema', 'The note\'s "tags" must be a list of strings.'))
  }
  if (typeof note.createdAt !== 'string') issues.push(issue('missing_field', 'The note is missing "createdAt".'))
  if (typeof note.updatedAt !== 'string') issues.push(issue('missing_field', 'The note is missing "updatedAt".'))
  if (
    note.generationMetadata !== null &&
    note.generationMetadata !== undefined &&
    (typeof note.generationMetadata !== 'object' || Array.isArray(note.generationMetadata))
  ) {
    issues.push(issue('invalid_schema', 'The note\'s "generationMetadata" must be an object or null.'))
  }

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    package: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      note: {
        title: note.title as string,
        content: note.content as string,
        tags: note.tags as string[],
        createdAt: note.createdAt as string,
        updatedAt: note.updatedAt as string,
        generationMetadata: (note.generationMetadata as Record<string, unknown> | null | undefined) ?? null,
      },
    },
  }
}

/** The file-upload entry point: parses raw text as JSON first, surfacing a malformed-JSON issue distinctly from a schema issue, then validates. */
export function parseNotePackage(rawText: string): PackageValidationResult<NotePackage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This file isn't valid JSON.")] }
  }
  return validateNotePackage(parsed)
}

export const notePackageValidator: PackageValidator<NotePackage> = { validate: validateNotePackage }
