import { isFuturePackageVersion, isSupportedPackageVersion } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageValidationIssue, PackageValidationResult, PackageValidator } from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'
import { estimateBase64DecodedByteLength } from '@/modules/knowledge-exchange/assets/base64'
import { MAX_ASSET_UPLOAD_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from '@/modules/assets/validation'

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

/**
 * Never trusts a package as pre-validated just because it came from this
 * app's own Export, exactly like `validateNotePackage`/
 * `validateKnowledgeNodePackage`. Collects every issue found rather than
 * stopping at the first.
 *
 * The oversized-payload check estimates the decoded byte length from the
 * base64 string's own length (`estimateBase64DecodedByteLength`) rather
 * than fully decoding it first — the same cap `uploadAsset`'s own
 * `validateImageFile` already enforces on a native upload
 * (`MAX_ASSET_UPLOAD_BYTES`), applied here before a potentially huge
 * string is ever decoded.
 */
export function validateAssetPackage(input: unknown): PackageValidationResult<AssetPackage> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like an asset package — expected a JSON object.")] }
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

  if (typeof pkg.asset !== 'object' || pkg.asset === null || Array.isArray(pkg.asset)) {
    issues.push(issue('missing_field', 'Missing "asset" field.'))
    return { valid: false, issues }
  }

  const asset = pkg.asset as Record<string, unknown>
  if (typeof asset.title !== 'string' || asset.title.trim() === '') {
    issues.push(issue('missing_field', 'The asset is missing a "title".'))
  }
  if (typeof asset.mimeType !== 'string' || !SUPPORTED_IMAGE_MIME_TYPES.includes(asset.mimeType as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
    issues.push(issue('invalid_schema', `The asset's "mimeType" (${JSON.stringify(asset.mimeType)}) is not a supported image type.`))
  }
  if (typeof asset.width !== 'number' || asset.width <= 0) issues.push(issue('invalid_schema', 'The asset is missing a valid "width".'))
  if (typeof asset.height !== 'number' || asset.height <= 0) issues.push(issue('invalid_schema', 'The asset is missing a valid "height".'))
  if (typeof asset.sizeBytes !== 'number' || asset.sizeBytes < 0) {
    issues.push(issue('invalid_schema', 'The asset is missing a valid "sizeBytes".'))
  }
  if (typeof asset.createdAt !== 'string') issues.push(issue('missing_field', 'The asset is missing "createdAt".'))

  if (typeof asset.fileDataBase64 !== 'string' || asset.fileDataBase64.length === 0) {
    issues.push(issue('missing_field', 'The asset is missing its file content.'))
  } else if (estimateBase64DecodedByteLength(asset.fileDataBase64) > MAX_ASSET_UPLOAD_BYTES) {
    issues.push(
      issue(
        'invalid_schema',
        `This image is too large to import (max ${Math.floor(MAX_ASSET_UPLOAD_BYTES / (1024 * 1024))}MB).`,
      ),
    )
  }

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    package: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      asset: {
        title: asset.title as string,
        mimeType: asset.mimeType as string,
        width: asset.width as number,
        height: asset.height as number,
        sizeBytes: asset.sizeBytes as number,
        createdAt: asset.createdAt as string,
        fileDataBase64: asset.fileDataBase64 as string,
      },
    },
  }
}

/** The file-upload entry point: parses raw text as JSON first, surfacing a malformed-JSON issue distinctly from a schema issue, then validates. */
export function parseAssetPackage(rawText: string): PackageValidationResult<AssetPackage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This file isn't valid JSON.")] }
  }
  return validateAssetPackage(parsed)
}

export const assetPackageValidator: PackageValidator<AssetPackage> = { validate: validateAssetPackage }
