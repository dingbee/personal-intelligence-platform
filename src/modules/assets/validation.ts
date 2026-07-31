/** UX-13.8.2 — smaller than documents' 200MB: images rarely need to be that large, and this keeps client-side canvas processing fast and memory-safe. */
export const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024

/** Formats browsers can reliably decode into a canvas via createImageBitmap/HTMLImageElement. SVG is intentionally excluded — it's not raster data with fixed pixel dimensions, so the derivative pipeline's resize-to-target-pixel-size model doesn't apply to it. */
export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export interface ImageValidationResult {
  valid: boolean
  error: string | null
}

/**
 * UX-13 Stabilization Sprint — mobile browsers (notably iOS Safari with
 * iCloud-backed or still-encoding camera photos) can hand back a File
 * whose `.size` reads 0 immediately after picking, before the underlying
 * blob has fully materialized. Reading `.size` synchronously right off
 * the picker's `change` event — the pattern every upload entry point used
 * — is exactly what triggers it, producing a false "File is empty"
 * rejection that only reproduces on mobile. Forcing a real read resolves
 * it; this is a no-op extra cost for the normal case where `.size` is
 * already correct.
 */
export async function resolveFileSize(file: File): Promise<number> {
  if (file.size > 0) return file.size
  const buffer = await file.arrayBuffer()
  return buffer.byteLength
}

export function validateImageFile(file: { type: string; size: number }): ImageValidationResult {
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
    return { valid: false, error: `Unsupported image type: ${file.type || 'unknown'}` }
  }
  if (file.size > MAX_ASSET_UPLOAD_BYTES) {
    return { valid: false, error: `Image exceeds ${Math.round(MAX_ASSET_UPLOAD_BYTES / (1024 * 1024))}MB limit` }
  }
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }
  return { valid: true, error: null }
}
