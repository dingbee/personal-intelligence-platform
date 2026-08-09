import type { AssetAnalysis } from '@/shared/types/database'

/**
 * PIP Stabilization v1 (P0, root cause C) — "Ask NOVA about this image"
 * used to seed the conversation with only `I'd like to talk about an
 * image called "${title}".`, regardless of whether analysis had actually
 * run — the model had nothing to answer from except a (often
 * filename-derived, meaningless) title. When analysis exists, this
 * carries the real description/extracted text along on the very first
 * turn, so the answer doesn't depend entirely on retrieveAssetContext
 * finding it independently. Never invents content: an unanalyzed image
 * gets an honest "haven't analyzed it yet" seed instead of a fabricated one.
 */
export function buildImageChatSeedQuery(title: string, metadata: AssetAnalysis | null): string {
  if (!metadata) {
    return `I just uploaded an image called "${title}" — ARRIYIA hasn't analyzed it yet.`
  }

  const parts = [`I'd like to talk about an image called "${title}". Here's what you found when you looked at it: ${metadata.description}`]
  if (metadata.extractedText) parts.push(`Visible text: ${metadata.extractedText}`)
  return parts.join(' ')
}
