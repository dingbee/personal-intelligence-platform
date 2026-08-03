import JSZip from 'jszip'
import { isFuturePackageVersion, isSupportedPackageVersion } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { DocumentFileType } from '@/shared/types/database'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'
import { DOCUMENT_PACKAGE_MANIFEST_ENTRY, DOCUMENT_PACKAGE_ORIGINAL_ENTRY } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { MAX_UPLOAD_BYTES } from '@/modules/library/utils/fileTypes'

/** Mirrors `DocumentFileType` (`shared/types/database.ts`) — kept as a self-contained validation-layer constant, not derived from the DB type, matching `SUPPORTED_IMAGE_MIME_TYPES`'s own precedent in the Asset package type. */
const SUPPORTED_DOCUMENT_FILE_TYPES: readonly DocumentFileType[] = [
  'pdf',
  'epub',
  'docx',
  'txt',
  'markdown',
  'xlsx',
  'csv',
  'ods',
]

/** Generous slack above `MAX_UPLOAD_BYTES` for the manifest entry plus zip framing overhead. `buildDocumentPackageZip` always stores the original file uncompressed, so a legitimately-produced package's outer size is never far above the original file's own size — anything past this slack cannot be a package this app produced, regardless of what it claims inside. */
const ARCHIVE_OVERHEAD_ALLOWANCE_BYTES = 256 * 1024
const MAX_DOCUMENT_PACKAGE_ARCHIVE_BYTES = MAX_UPLOAD_BYTES + ARCHIVE_OVERHEAD_ALLOWANCE_BYTES

export interface ValidatedDocumentPackage {
  manifest: DocumentPackageManifest
  /** The CRC-verified, fully-parsed archive — the `original` entry's bytes are readable via `zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)!.async(...)` without re-parsing, for a future import phase to use. */
  zip: JSZip
}

export type DocumentPackageValidationResult =
  | { valid: true; package: ValidatedDocumentPackage }
  | { valid: false; issues: PackageValidationIssue[] }

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

/**
 * jszip has no public, documented way to read an entry's central-
 * directory-declared uncompressed size before decompressing it — its own
 * bundled type definitions mark the `_data` field that carries it as
 * private ("If/when it is made public this should be uncommented",
 * `node_modules/jszip/index.d.ts`). This reads that private field
 * defensively: if a future jszip version renames or removes it, this
 * returns `null` and the caller treats an unverifiable size as unsafe
 * (reject), never as "skip the check."
 */
function readDeclaredUncompressedSize(entry: JSZip.JSZipObject): number | null {
  const internal = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data
  return typeof internal?.uncompressedSize === 'number' ? internal.uncompressedSize : null
}

function validateManifestShape(
  input: unknown,
): { valid: true; manifest: DocumentPackageManifest } | { valid: false; issues: PackageValidationIssue[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "The package manifest isn't a JSON object.")] }
  }
  const pkg = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (typeof pkg.version !== 'number') {
    issues.push(issue('missing_field', 'Missing or invalid "version" field.'))
  } else if (isFuturePackageVersion(pkg.version)) {
    issues.push(
      issue(
        'future_version',
        `This package was exported by a newer version of NOVA (package version ${pkg.version}) that this app can't import yet.`,
      ),
    )
  } else if (!isSupportedPackageVersion(pkg.version)) {
    issues.push(issue('unsupported_version', `Package version ${JSON.stringify(pkg.version)} is not supported.`))
  }

  if (typeof pkg.exportedAt !== 'string') issues.push(issue('missing_field', 'Missing "exportedAt" field.'))
  if (typeof pkg.sourceVersion !== 'string') issues.push(issue('missing_field', 'Missing "sourceVersion" field.'))

  if (typeof pkg.document !== 'object' || pkg.document === null || Array.isArray(pkg.document)) {
    issues.push(issue('missing_field', 'Missing "document" field.'))
    return { valid: false, issues }
  }

  const doc = pkg.document as Record<string, unknown>
  if (typeof doc.title !== 'string' || doc.title.trim() === '') issues.push(issue('missing_field', 'The document is missing a "title".'))
  if (typeof doc.fileName !== 'string' || doc.fileName.trim() === '') {
    issues.push(issue('missing_field', 'The document is missing a "fileName".'))
  }
  if (typeof doc.fileType !== 'string' || !SUPPORTED_DOCUMENT_FILE_TYPES.includes(doc.fileType as DocumentFileType)) {
    issues.push(issue('invalid_schema', `The document's "fileType" (${JSON.stringify(doc.fileType)}) is not a supported file type.`))
  }
  if (typeof doc.sizeBytes !== 'number' || doc.sizeBytes < 0) {
    issues.push(issue('invalid_schema', 'The document is missing a valid "sizeBytes".'))
  }
  if (typeof doc.createdAt !== 'string') issues.push(issue('missing_field', 'The document is missing "createdAt".'))
  if (!Array.isArray(doc.tags) || !doc.tags.every((tag) => typeof tag === 'string')) {
    issues.push(issue('invalid_schema', 'The document\'s "tags" must be a list of strings.'))
  }

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    manifest: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      document: {
        title: doc.title as string,
        fileName: doc.fileName as string,
        fileType: doc.fileType as DocumentFileType,
        sizeBytes: doc.sizeBytes as number,
        createdAt: doc.createdAt as string,
        tags: doc.tags as string[],
      },
    },
  }
}

/**
 * The file-upload entry point for Documents. Unlike every other package
 * type (JSON text → `JSON.parse` → sync validate), a document package is
 * a ZIP archive, so this is async and operates on raw bytes, not on an
 * already-parsed JS value — it cannot implement the shared, synchronous
 * `PackageValidator<TPackage>` interface for exactly that reason, and
 * this phase deliberately does not change that interface (every other
 * package type still correctly relies on it being sync). Kept as its own
 * compatible-in-spirit shape instead.
 *
 * Two-pass zip loading, deliberately in this order — the zip-bomb
 * defense:
 *
 * 1. A cheap, no-decompression pass (`loadAsync` without `checkCRC32`) —
 *    parses only the central directory (entry names + declared sizes),
 *    decompresses nothing. Used to reject a structurally wrong package
 *    (extra/missing entries) or a declared-oversized `original` entry
 *    entirely before any bytes are decompressed, so a maliciously huge
 *    declared size costs nothing to reject.
 * 2. Only once pass 1 confirms the `original` entry's declared size is
 *    within `MAX_UPLOAD_BYTES`, a second `loadAsync(..., {checkCRC32:
 *    true})` pass — jszip's own public, documented integrity option —
 *    fully decompresses and CRC32-verifies every entry, since
 *    decompression is now known to be bounded by a size this app
 *    already accepts for a native upload.
 */
export async function parseDocumentPackageZip(zipInput: Blob): Promise<DocumentPackageValidationResult> {
  if (zipInput.size > MAX_DOCUMENT_PACKAGE_ARCHIVE_BYTES) {
    return {
      valid: false,
      issues: [
        issue(
          'invalid_schema',
          `This package is too large (max ${Math.floor(MAX_DOCUMENT_PACKAGE_ARCHIVE_BYTES / (1024 * 1024))}MB).`,
        ),
      ],
    }
  }

  let structuralZip: JSZip
  try {
    structuralZip = await JSZip.loadAsync(zipInput)
  } catch {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a document package — not a valid zip archive.")] }
  }

  const entryNames = Object.keys(structuralZip.files).filter((name) => !structuralZip.files[name]!.dir)
  const expectedEntryNames = [DOCUMENT_PACKAGE_MANIFEST_ENTRY, DOCUMENT_PACKAGE_ORIGINAL_ENTRY]
  const hasExactlyExpectedEntries =
    entryNames.length === expectedEntryNames.length && expectedEntryNames.every((name) => entryNames.includes(name))
  if (!hasExactlyExpectedEntries) {
    return {
      valid: false,
      issues: [issue('invalid_schema', 'This package has unexpected contents — it does not match the expected document package format.')],
    }
  }

  const originalEntry = structuralZip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)!
  const declaredOriginalSize = readDeclaredUncompressedSize(originalEntry)
  if (declaredOriginalSize === null || declaredOriginalSize > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      issues: [issue('invalid_schema', `This document is too large to import (max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB).`)],
    }
  }

  let verifiedZip: JSZip
  try {
    verifiedZip = await JSZip.loadAsync(zipInput, { checkCRC32: true })
  } catch {
    return { valid: false, issues: [issue('invalid_schema', 'This package is corrupted (checksum verification failed).')] }
  }

  let manifestText: string
  try {
    manifestText = await verifiedZip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY)!.async('text')
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This package's manifest could not be read.")] }
  }

  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(manifestText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This package's manifest isn't valid JSON.")] }
  }

  const manifestResult = validateManifestShape(manifestJson)
  if (!manifestResult.valid) return manifestResult

  return { valid: true, package: { manifest: manifestResult.manifest, zip: verifiedZip } }
}
