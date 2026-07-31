import { computeTargetDimensions, DERIVATIVE_MAX_EDGE, type Dimensions } from '@/modules/assets/dimensions'

export interface GeneratedDerivatives {
  /** The source image's own pixel size — stored on the assets row (width/height). */
  natural: Dimensions
  optimized: Blob
  thumbnail: Blob
  /** Both derivatives are encoded in this format — WebP when the browser can actually produce it, JPEG otherwise. Never the source format: re-encoding is the whole point of "compress." */
  outputMimeType: string
}

const OUTPUT_QUALITY = 0.85

/**
 * UX-13.8.2 — the browser can't be asked "do you support encoding WebP,"
 * only "try it and see what you got back": canvas.toBlob silently falls
 * back to PNG in browsers that accept the 'image/webp' argument without
 * error but can't actually produce it, so the only reliable check is a
 * real round-trip on a throwaway 1x1 canvas.
 */
function canEncodeWebp(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    canvas.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp')
  })
}

function drawResized(bitmap: ImageBitmap, target: Dimensions, mimeType: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, target.width, target.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))), mimeType, quality)
  })
}

/**
 * UX-13.8.2 — the actual "compress" + "generate derivatives" steps of the
 * asset pipeline: decode once (createImageBitmap), resize twice
 * (computeTargetDimensions' pure math, drawn through a canvas), encode
 * both to the smallest format the browser can actually produce. Never
 * upscales — computeTargetDimensions already guarantees that. Runs
 * entirely client-side; no new dependency (createImageBitmap/canvas are
 * platform APIs), same "reuse what the browser already gives you" choice
 * as reusing pdfjs-dist for the PDF reader rather than adding a second
 * PDF library.
 */
export async function generateDerivatives(file: File): Promise<GeneratedDerivatives> {
  const bitmap = await createImageBitmap(file)
  try {
    const natural: Dimensions = { width: bitmap.width, height: bitmap.height }
    const outputMimeType = (await canEncodeWebp()) ? 'image/webp' : 'image/jpeg'

    const optimizedSize = computeTargetDimensions(natural, DERIVATIVE_MAX_EDGE.optimized)
    const thumbnailSize = computeTargetDimensions(natural, DERIVATIVE_MAX_EDGE.thumbnail)

    const [optimized, thumbnail] = await Promise.all([
      drawResized(bitmap, optimizedSize, outputMimeType, OUTPUT_QUALITY),
      drawResized(bitmap, thumbnailSize, outputMimeType, OUTPUT_QUALITY),
    ])

    return { natural, optimized, thumbnail, outputMimeType }
  } finally {
    bitmap.close()
  }
}
