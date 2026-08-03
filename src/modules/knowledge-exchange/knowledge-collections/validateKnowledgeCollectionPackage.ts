import JSZip from 'jszip'
import { isFuturePackageVersion, isSupportedPackageVersion } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageValidationIssue } from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { CollectionMemberEntry, CollectionMemberType, CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import { COLLECTION_PACKAGE_MANIFEST_ENTRY } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageArchive'
import { validateKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/validateKnowledgeNodePackage'
import { validateNotePackage } from '@/modules/knowledge-exchange/notes/validateNotePackage'
import { validateAssetPackage } from '@/modules/knowledge-exchange/assets/validateAssetPackage'
import { validateDocumentPackageManifestShape, parseDocumentPackageZip, type ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import { validateKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/validateKnowledgeLinkPackage'

const KNOWN_MEMBER_TYPES: readonly CollectionMemberType[] = ['knowledge_node', 'note', 'asset', 'document', 'conversation']

/**
 * Generous total-package cap — a collection can hold several
 * Document/Asset members, each already independently bounded (a
 * `document` member's own nested zip is re-validated through the
 * unmodified `parseDocumentPackageZip`, which enforces the same
 * `MAX_UPLOAD_BYTES`-based cap a single Document package already does; an
 * `asset` member's base64 payload is bounded the same way by
 * `validateAssetPackage`'s own `MAX_ASSET_UPLOAD_BYTES` check). This is
 * the *additional*, total-archive-level cap the discovery's §4/§9 called
 * for deciding at implementation time — rejected before any decompression,
 * the same zip-bomb defense `parseDocumentPackageZip` already established.
 */
const MAX_COLLECTION_PACKAGE_ARCHIVE_BYTES = 1024 * 1024 * 1024

export interface ValidatedCollectionPackage {
  manifest: CollectionPackageManifest
  /** The CRC-verified, fully-parsed outer archive. */
  zip: JSZip
  /** Each `document` member's own nested zip, pre-parsed and CRC-verified via the unmodified `parseDocumentPackageZip` — keyed by that member's `archiveEntry` — so the importer never re-parses/re-checks a nested zip this validator already fully verified. */
  documentMembers: Map<string, ValidatedDocumentPackage>
}

export type CollectionPackageValidationResult =
  | { valid: true; package: ValidatedCollectionPackage }
  | { valid: false; issues: PackageValidationIssue[] }

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

function isKnownMemberType(value: unknown): value is CollectionMemberType {
  return typeof value === 'string' && (KNOWN_MEMBER_TYPES as readonly string[]).includes(value)
}

/**
 * Validates one member entry's shape, dispatching each known `memberType`
 * to that type's own existing, unmodified validator over `payload` — a
 * Collection member embeds the *exact*, full package (with its own
 * `version`/`exportedAt`/`sourceVersion`) that type's own single-object
 * Export already produces, so there is no separate "member payload shape"
 * to invent; the same `validate<Type>Package` function already does this.
 *
 * An entry whose `memberType` isn't one of the five real, currently-known
 * `CollectionItemType`s (§0 of the discovery: `knowledge_link` was never
 * one either) is rejected outright, not softly skipped — building the
 * "tolerate a future, unrecognized member type and still import the rest"
 * machinery the discovery's §8 muses about for a hypothetical future
 * package would be exactly the "speculative architecture" this
 * engagement's constraints forbid for a member type nobody can produce
 * with this app build. `conversation`'s stub shape has no existing package
 * type to reuse (§2.5 — no Conversation Exchange exists), so it gets a
 * small, self-contained shape check here instead.
 */
function validateMemberEntry(input: unknown, index: number): { valid: true; entry: CollectionMemberEntry } | { valid: false; issues: PackageValidationIssue[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', `Member #${index + 1} isn't a JSON object.`)] }
  }
  const raw = input as Record<string, unknown>

  if (!isKnownMemberType(raw.memberType)) {
    return { valid: false, issues: [issue('invalid_schema', `Member #${index + 1} has an unrecognized member type (${JSON.stringify(raw.memberType)}).`)] }
  }
  if (typeof raw.originalAddedAt !== 'string') {
    return { valid: false, issues: [issue('missing_field', `Member #${index + 1} is missing "originalAddedAt".`)] }
  }

  if (raw.memberType === 'knowledge_node') {
    const result = validateKnowledgeNodePackage(raw.payload)
    if (!result.valid) return { valid: false, issues: result.issues }
    return { valid: true, entry: { memberType: 'knowledge_node', originalAddedAt: raw.originalAddedAt, payload: result.package } }
  }
  if (raw.memberType === 'note') {
    const result = validateNotePackage(raw.payload)
    if (!result.valid) return { valid: false, issues: result.issues }
    return { valid: true, entry: { memberType: 'note', originalAddedAt: raw.originalAddedAt, payload: result.package } }
  }
  if (raw.memberType === 'asset') {
    const result = validateAssetPackage(raw.payload)
    if (!result.valid) return { valid: false, issues: result.issues }
    return { valid: true, entry: { memberType: 'asset', originalAddedAt: raw.originalAddedAt, payload: result.package } }
  }
  if (raw.memberType === 'document') {
    if (typeof raw.archiveEntry !== 'string' || raw.archiveEntry.trim() === '') {
      return { valid: false, issues: [issue('missing_field', `Member #${index + 1} (document) is missing its "archiveEntry".`)] }
    }
    const result = validateDocumentPackageManifestShape(raw.payload)
    if (!result.valid) return { valid: false, issues: result.issues }
    return { valid: true, entry: { memberType: 'document', originalAddedAt: raw.originalAddedAt, payload: result.manifest, archiveEntry: raw.archiveEntry } }
  }
  // raw.memberType === 'conversation'
  if (raw.unsupported !== true) {
    return { valid: false, issues: [issue('invalid_schema', `Member #${index + 1} (conversation) must be marked "unsupported".`)] }
  }
  if (typeof raw.title !== 'string') {
    return { valid: false, issues: [issue('missing_field', `Member #${index + 1} (conversation) is missing a "title".`)] }
  }
  return { valid: true, entry: { memberType: 'conversation', originalAddedAt: raw.originalAddedAt, unsupported: true, title: raw.title } }
}

function validateManifestShape(
  input: unknown,
): { valid: true; manifest: CollectionPackageManifest } | { valid: false; issues: PackageValidationIssue[] } {
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

  if (typeof pkg.collection !== 'object' || pkg.collection === null || Array.isArray(pkg.collection)) {
    issues.push(issue('missing_field', 'Missing "collection" field.'))
    return { valid: false, issues }
  }

  const collection = pkg.collection as Record<string, unknown>
  if (typeof collection.name !== 'string' || collection.name.trim() === '') {
    issues.push(issue('missing_field', 'The collection is missing a "name".'))
  }
  if (collection.description !== null && typeof collection.description !== 'string') {
    issues.push(issue('invalid_schema', 'The collection\'s "description" must be a string or null.'))
  }
  if (!Array.isArray(collection.members)) {
    issues.push(issue('missing_field', 'The collection is missing its "members" list.'))
    return { valid: false, issues }
  }

  const members: CollectionMemberEntry[] = []
  collection.members.forEach((rawMember, index) => {
    const result = validateMemberEntry(rawMember, index)
    if (!result.valid) issues.push(...result.issues)
    else members.push(result.entry)
  })

  const documentEntryPaths = members.filter((m) => m.memberType === 'document').map((m) => m.archiveEntry)
  const duplicateEntryPaths = documentEntryPaths.filter((path, index) => documentEntryPaths.indexOf(path) !== index)
  if (duplicateEntryPaths.length > 0) {
    issues.push(issue('invalid_schema', 'Duplicate member identifiers — more than one document member references the same archive entry.'))
  }

  const relationshipsRaw = collection.relationships ?? []
  if (!Array.isArray(relationshipsRaw)) {
    issues.push(issue('invalid_schema', 'The collection\'s "relationships" must be a list.'))
  }
  const relationships = Array.isArray(relationshipsRaw)
    ? relationshipsRaw.flatMap((rawLink) => {
        const result = validateKnowledgeLinkPackage(rawLink)
        if (!result.valid) {
          issues.push(...result.issues)
          return []
        }
        return [result.package]
      })
    : []

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    manifest: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      collection: {
        name: collection.name as string,
        description: (collection.description as string | null | undefined) ?? null,
        members,
        relationships,
      },
    },
  }
}

/**
 * The file-upload entry point for Collections. Like Documents (and unlike
 * every JSON-only package type), a collection package is a ZIP archive, so
 * this is async and operates on raw bytes — same two-pass structural/CRC
 * zip-bomb defense `parseDocumentPackageZip` already established, applied
 * here to the *outer* archive; each `document` member's own *nested*
 * archive is independently re-verified via that exact same unmodified
 * function, one call per document member.
 */
export async function parseKnowledgeCollectionPackageZip(zipInput: Blob): Promise<CollectionPackageValidationResult> {
  if (zipInput.size > MAX_COLLECTION_PACKAGE_ARCHIVE_BYTES) {
    return {
      valid: false,
      issues: [
        issue(
          'invalid_schema',
          `This package is too large (max ${Math.floor(MAX_COLLECTION_PACKAGE_ARCHIVE_BYTES / (1024 * 1024))}MB).`,
        ),
      ],
    }
  }

  let structuralZip: JSZip
  try {
    structuralZip = await JSZip.loadAsync(zipInput)
  } catch {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a collection package — not a valid zip archive.")] }
  }

  if (!structuralZip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY)) {
    return { valid: false, issues: [issue('missing_field', 'This package is missing its manifest.')] }
  }

  let verifiedZip: JSZip
  try {
    verifiedZip = await JSZip.loadAsync(zipInput, { checkCRC32: true })
  } catch {
    return { valid: false, issues: [issue('invalid_schema', 'This package is corrupted (checksum verification failed).')] }
  }

  let manifestText: string
  try {
    manifestText = await verifiedZip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY)!.async('text')
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
  const { manifest } = manifestResult

  const issues: PackageValidationIssue[] = []
  const documentMembers = new Map<string, ValidatedDocumentPackage>()

  for (const member of manifest.collection.members) {
    if (member.memberType !== 'document') continue
    const nestedEntry = verifiedZip.file(member.archiveEntry)
    if (!nestedEntry) {
      issues.push(issue('missing_field', `This package is missing the embedded document archive at "${member.archiveEntry}".`))
      continue
    }
    const nestedBytes = await nestedEntry.async('blob')
    const nestedResult = await parseDocumentPackageZip(nestedBytes)
    if (!nestedResult.valid) {
      issues.push(...nestedResult.issues)
      continue
    }
    documentMembers.set(member.archiveEntry, nestedResult.package)
  }

  if (issues.length > 0) return { valid: false, issues }

  return { valid: true, package: { manifest, zip: verifiedZip, documentMembers } }
}
