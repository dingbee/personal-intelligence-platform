import { getChatProvider } from '@/modules/ai/providers/registry'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { getAssetSignedUrl, updateAssetMetadata } from '@/modules/assets/api/assets'
import { parseImageAnalysisResponse } from '@/modules/assets/intelligence/parseImageAnalysisResponse'
import type { Asset, AssetAnalysis } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1 — deliberately grounded, not confident-
 * sounding: NOVA describes what it sees and transcribes visible text, but
 * never claims a calibrated accuracy/confidence figure (no provider in
 * this codebase exposes one for vision output) and never invents content
 * beyond what's actually visible. See docs/multimodal-intelligence-discovery.md §4.
 */
export const ANALYZE_IMAGE_SYSTEM_PROMPT = `You are NOVA, analyzing an image the user uploaded to their personal knowledge workspace.

Describe what the image shows in 2-4 plain-language sentences, grounded only in what is visible. Do not speculate about anything not actually shown.

Then, on a new line, write "TEXT:" followed by any text visible in the image, transcribed verbatim. If there is no visible text, write "TEXT: (none)".`

/**
 * A one-shot vision call, not a registered `capability` — capabilities'
 * prompt templates are string-variable substitution only
 * (RunCapabilityParams.variables: Record<string,string>), which can't
 * carry an image. This calls streamChatCompletion directly (the same
 * shared logging/observability layer runCapability itself uses) with a
 * ChatContentPart[] message instead.
 */
export async function analyzeImage(params: {
  asset: Pick<Asset, 'id' | 'optimized_path'>
  userId: string
  workspaceId: string | null
  providerId: string
  requestedProviderId?: string
}): Promise<AssetAnalysis> {
  const imageUrl = await getAssetSignedUrl(params.asset.optimized_path)
  const provider = getChatProvider(params.providerId)

  const { content } = await streamChatCompletion({
    provider,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this image.' },
          { type: 'image', imageUrl },
        ],
      },
    ],
    system: ANALYZE_IMAGE_SYSTEM_PROMPT,
    userId: params.userId,
    workspaceId: params.workspaceId,
    feature: 'analyze-image',
    requestedProvider: params.requestedProviderId,
  })

  const { description, extractedText } = parseImageAnalysisResponse(content)
  const metadata: AssetAnalysis = {
    description,
    extractedText,
    analyzedAt: new Date().toISOString(),
    provider: provider.id,
  }

  await updateAssetMetadata(params.asset.id, metadata)
  return metadata
}
