import { uploadAsset } from '@/modules/assets/api/assets'
import type { Asset } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'
import { base64ToUint8Array } from '@/modules/knowledge-exchange/assets/base64'

/** Generic, inert placeholder filename — `uploadAsset` never derives its actual storage path from `File.name` (the path is always `${userId}/${crypto.randomUUID()}/...`), and `title` is always passed explicitly here, so the reconstructed `File`'s name has no effect on the imported row. No sanitization needed because the value is functionally unused beyond satisfying the `File` constructor. */
function placeholderFilename(mimeType: string): string {
  const ext = mimeType.split('/')[1] ?? 'bin'
  return `imported-image.${ext}`
}

/**
 * Always `uploadAsset` (the same full pipeline a manual upload already
 * uses) — never a direct insert — so every property this framework's
 * security review requires falls out of reusing existing, unmodified
 * code rather than being reimplemented here:
 *
 * - No arbitrary storage path injection: `uploadAsset` always generates
 *   its own fresh path from `crypto.randomUUID()` keyed to the
 *   *importer's own* `userId`; the package never supplies a storage path.
 * - No unsigned/signed URL reuse: the package contains no storage
 *   path or URL at all, only raw base64 bytes.
 * - No ownership escalation: `owner_id` is always `context.userId`,
 *   from `uploadAsset`'s own contract, never derived from the package.
 * - No execution of uploaded content: decoding is client-side
 *   canvas/Blob work (`createImageBitmap` inside `generateDerivatives`),
 *   never script execution; SVG is already excluded from
 *   `SUPPORTED_IMAGE_MIME_TYPES`.
 * - No bypass of existing asset processing: this calls the literal,
 *   unmodified `uploadAsset` — same `validateImageFile` MIME/size check,
 *   same `generateDerivatives` decode-integrity check and derivative
 *   regeneration as a manual upload.
 *
 * Always creates a brand-new asset (never an update/dedup) — unlike
 * Knowledge Nodes, there is no meaningful "same asset" identity to
 * resolve against, so this mirrors Notes' always-create precedent, not
 * Knowledge Nodes' `resolveCanonicalNode` one.
 */
export async function importAssetPackage(pkg: AssetPackage, context: PackageImportContext): Promise<Asset> {
  // `.buffer` (not the Uint8Array view itself) — `base64ToUint8Array` always allocates a
  // fresh, exactly-sized buffer, so this loses nothing; it exists only to satisfy
  // `BlobPart`'s stricter `ArrayBuffer` (not `ArrayBufferLike`) typing.
  const bytes = base64ToUint8Array(pkg.asset.fileDataBase64)
  const file = new File([bytes.buffer as ArrayBuffer], placeholderFilename(pkg.asset.mimeType), { type: pkg.asset.mimeType })

  return uploadAsset({
    file,
    userId: context.userId,
    workspaceId: context.workspaceId,
    title: pkg.asset.title,
  })
}

export const assetPackageImporter: PackageImporter<AssetPackage, Asset> = {
  import: importAssetPackage,
}
