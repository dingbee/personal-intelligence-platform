import type { Asset } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'

/**
 * Pure — takes an already-fetched asset and its already-base64-encoded
 * original file bytes, builds the versioned package. No fetch here: the
 * export button's caller fetches the signed URL, downloads the blob, and
 * base64-encodes it first (`fetchAssetOriginalAsBase64`), keeping this
 * exporter itself synchronous like every other package type's exporter.
 */
export function exportAssetPackage(source: { asset: Asset; fileDataBase64: string }): AssetPackage {
  const { asset, fileDataBase64 } = source
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    asset: {
      title: asset.title,
      mimeType: asset.mime_type,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.size_bytes,
      createdAt: asset.created_at,
      fileDataBase64,
    },
  }
}

export const assetPackageExporter: PackageExporter<{ asset: Asset; fileDataBase64: string }, AssetPackage> = {
  export: exportAssetPackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same pattern `notePackageFilename`/`knowledgeNodePackageFilename` already established. */
export function assetPackageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'asset-export'}.json`
}
