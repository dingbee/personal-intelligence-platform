import { getChatProvider } from '@/modules/ai/providers/registry'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { getAssetSignedUrl, updateAssetMetadata } from '@/modules/assets/api/assets'
import { parseImageAnalysisResponse } from '@/modules/assets/intelligence/parseImageAnalysisResponse'
import type { Asset, AssetAnalysis } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1/v2 — deliberately grounded, not confident-
 * sounding: NOVA describes what it sees and transcribes visible text, but
 * never claims a calibrated accuracy/confidence figure (no provider in
 * this codebase exposes one for vision output) and never invents content
 * beyond what's actually visible. CONFIDENCE (v2) asks the model for its
 * own self-assessment — explicitly framed as an estimate, not a
 * guarantee — never a substitute for real calibrated confidence. See
 * docs/multimodal-intelligence-v2-discovery.md §5.
 */
export const ANALYZE_IMAGE_SYSTEM_PROMPT = `You are NOVA, analyzing an image the user uploaded to their personal knowledge workspace.

Describe what the image shows in 2-4 plain-language sentences, grounded only in what is visible. Do not speculate about anything not actually shown. If the image contains data, figures, or trends (e.g. a dashboard, spreadsheet, or chart), mention the specific numbers and what they indicate.

Then include each of the following on its own line:

"TEXT:" followed by any text visible in the image, transcribed verbatim. If there is no visible text, write "TEXT: (none)".

"LANGUAGE:" followed by the primary language of any visible text (e.g. "English"), or "none" if there is no text.

"CONFIDENCE:" followed by your own rough self-assessment as three comma-separated values in the form text=0.9, entities=0.8, relationships=0.7 — estimate independently how confident you are in (1) the text you transcribed, (2) the entities/subjects you identified, (3) any relationships between them. This is your own estimate, not a guarantee.`

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

  const { description, extractedText, detectedLanguage, confidence } = parseImageAnalysisResponse(content)
  const metadata: AssetAnalysis = {
    description,
    extractedText,
    detectedLanguage,
    confidence,
    // Populated by useAnalyzeImage's follow-up runDocumentIntelligenceFromContent
    // step, not this vision-only call — see that hook for the merge.
    documentIntelligence: null,
    analyzedAt: new Date().toISOString(),
    provider: provider.id,
  }

  await updateAssetMetadata(params.asset.id, metadata)
  return metadata
}
