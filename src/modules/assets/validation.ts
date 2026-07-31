/** UX-13.8.2 — smaller than documents' 200MB: images rarely need to be that large, and this keeps client-side canvas processing fast and memory-safe. */
export const MAX_ASSET_UPLOAD_BYTES = 25 * 1024 * 1024

/** Formats browsers can reliably decode into a canvas via createImageBitmap/HTMLImageElement. SVG is intentionally excluded — it's not raster data with fixed pixel dimensions, so the derivative pipeline's resize-to-target-pixel-size model doesn't apply to it. */
export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export interface ImageValidationResult {
  valid: boolean
  error: string | null
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
