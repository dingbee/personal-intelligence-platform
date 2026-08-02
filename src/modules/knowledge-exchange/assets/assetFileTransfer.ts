import { getAssetSignedUrl } from '@/modules/assets/api/assets'
import { uint8ArrayToBase64 } from '@/modules/knowledge-exchange/assets/base64'

/**
 * The one place in this package type that does real I/O. Every other
 * exporter in this framework (`PackageExporter.export()`) is a pure
 * synchronous function over already-fetched data — that contract stays
 * intact for `exportAssetPackage.ts` itself. Assets are the first
 * package type whose export genuinely needs an async fetch first (the
 * private `assets` storage bucket has no direct public URL — reading the
 * original bytes means a signed URL, same as `useSignedAssetUrl`
 * already does for display), so that fetch lives here as separate
 * UI/hook-layer glue, called by the Export button before it builds the
 * package, not inside the exporter.
 */
export async function fetchAssetOriginalAsBase64(asset: { original_path: string }): Promise<string> {
  const signedUrl = await getAssetSignedUrl(asset.original_path)
  const response = await fetch(signedUrl)
  if (!response.ok) throw new Error(`Failed to download the original image (${response.status}).`)
  const buffer = await response.arrayBuffer()
  return uint8ArrayToBase64(new Uint8Array(buffer))
}
