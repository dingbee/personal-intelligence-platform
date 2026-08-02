/**
 * UX-14.5.10.2 — Asset Exchange Implementation.
 *
 * Notes and Knowledge Nodes never needed binary I/O, so the package
 * framework has no existing base64 convention to reuse. Assets are the
 * first package type whose export contract embeds raw file bytes (see
 * `assetPackageTypes.ts`'s own doc-comment for the portability/security
 * reasoning), so this is the one deliberate, minimal structural addition
 * this phase makes to the framework's file layout.
 */

/** Chunk size for `String.fromCharCode` — well under engines' argument-count limits, so a 25MB image (`MAX_ASSET_UPLOAD_BYTES`) never risks a stack overflow the way `String.fromCharCode(...bytes)` would applied to the whole array at once. */
const BASE64_CHUNK_SIZE = 0x8000

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * A formula-based estimate of the decoded byte length of a base64 string,
 * used to reject an oversized package *before* fully decoding a
 * potentially huge string (`validateAssetPackage.ts`'s size-cap check).
 * Ignores whitespace/newlines the string shouldn't contain in a
 * `JSON.parse`d value; not exact for malformed base64, but a malformed
 * string fails `base64ToUint8Array`/`atob` on import regardless.
 */
export function estimateBase64DecodedByteLength(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  let padding = 0
  if (base64.endsWith('==')) padding = 2
  else if (base64.endsWith('=')) padding = 1
  return Math.floor((len * 3) / 4) - padding
}
