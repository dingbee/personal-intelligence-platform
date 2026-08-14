import type { AssetAnalysis } from '@/shared/types/database'
import type { DerivationReference, EvidenceReference, SourceReference } from '@/shared/provenance/types'

/**
 * Image Intelligence -> shared provenance adapter. Maps an already-
 * computed AssetAnalysis (from the real analyzeImage.ts vision call —
 * this adapter never calls a provider itself) into the three-way
 * distinction the sprint brief requires:
 *
 *   SOURCE      the asset itself (`asset.id`/`asset.title`) — the image,
 *               untouched.
 *   EVIDENCE    the extracted interpretation — `metadata.extractedText`
 *               (verbatim transcribed text) when present, else
 *               `metadata.description` (the model's free-language
 *               description) — never both conflated into one field.
 *   DERIVATION  the AI-derived conclusion — always `metadata.description`,
 *               kind:'interpretation', explicitly distinct from the raw
 *               transcription even when the same text happens to also be
 *               the evidence excerpt (a pure description-only image has
 *               no separate transcription, so evidence and derivation
 *               legitimately share text — they remain conceptually
 *               distinct fields, not merged).
 *
 * `location` is `{kind:'whole'}`: analyzeImage.ts's own output (region/
 * coordinate-free — confirmed by reading its parsed shape) carries no
 * sub-image location today. This adapter does not invent one; a future
 * region-aware vision analysis would populate `{kind:'region', ...}`
 * instead, additively.
 *
 * A below-0.5 self-reported confidence is preserved verbatim in the
 * derivation's `statement` as an explicit caveat (mirroring
 * buildAssetContextContent.ts's own "say so if asked" discipline) rather
 * than silently dropped or upgraded to certainty.
 */
export function assetAnalysisToProvenance(
  asset: { id: string; title: string },
  metadata: AssetAnalysis,
): { evidence: EvidenceReference; derivation: DerivationReference } {
  const source: SourceReference = { type: 'asset', id: asset.id, title: asset.title }
  const evidenceId = `asset:${asset.id}`

  const evidence: EvidenceReference = {
    id: evidenceId,
    source,
    location: { kind: 'whole' },
    excerpt: metadata.extractedText ?? metadata.description,
    retrievedAt: metadata.analyzedAt,
  }

  const lowConfidenceParts: string[] = []
  if (metadata.confidence) {
    if (metadata.confidence.text !== null && metadata.confidence.text < 0.5) lowConfidenceParts.push('transcribed text')
    if (metadata.confidence.entities !== null && metadata.confidence.entities < 0.5) lowConfidenceParts.push('identified entities')
    if (metadata.confidence.relationships !== null && metadata.confidence.relationships < 0.5) lowConfidenceParts.push('identified relationships')
  }
  const statement = lowConfidenceParts.length > 0 ? `${metadata.description} (low self-reported confidence: ${lowConfidenceParts.join(', ')})` : metadata.description

  const derivation: DerivationReference = {
    id: `${evidenceId}:interpretation`,
    kind: 'interpretation',
    evidenceIds: [evidenceId],
    basedOnDerivationIds: [],
    statement,
    method: null,
  }

  return { evidence, derivation }
}
