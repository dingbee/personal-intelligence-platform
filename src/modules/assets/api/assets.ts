import { supabase } from '@/shared/lib/supabase'
import type { Asset, AssetAnalysis } from '@/shared/types/database'
import { resolveFileSize, validateImageFile } from '@/modules/assets/validation'
import { generateDerivatives } from '@/modules/assets/pipeline/generateDerivatives'

const BUCKET = 'assets'
/** How long a signed URL for serving an optimized/thumbnail image stays valid — long enough for a page view, short enough that a leaked URL isn't a standing access grant. */
const SIGNED_URL_TTL_SECONDS = 60 * 60

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME_TYPE[mimeType] ?? 'bin'
}

export async function listAssets(params: { workspaceId?: string | null; search?: string } = {}): Promise<Asset[]> {
  let query = supabase.from('assets').select('*').order('created_at', { ascending: false })
  if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)
  // UX-13.9 — plain title match, the same non-semantic search documents'
  // own Library search box already uses (library/api/documents.ts).
  // Deliberately not a SearchProvider registered on the universal /search
  // page — that page is semantic-only (every provider takes a query
  // embedding), and embeddings for assets are out of scope this phase.
  if (params.search) query = query.ilike('title', `%${params.search}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * UX-13.8.2 — the full asset pipeline in one call: validate -> compress +
 * generate derivatives (generateDerivatives) -> upload all three paths ->
 * store metadata. Storage objects are namespaced `${userId}/${assetId}/...`,
 * the same per-user folder convention documents' storage path uses (and
 * what the assets bucket's RLS policy checks against). Mirrors
 * uploadDocument's upload-then-insert shape, including its accepted risk:
 * if the metadata insert fails after a successful storage upload, the
 * objects are orphaned rather than rolled back — the same tradeoff
 * uploadDocument already makes, not a new one.
 */
export async function uploadAsset(params: {
  file: File
  userId: string
  workspaceId: string | null
  title?: string
}): Promise<Asset> {
  const size = await resolveFileSize(params.file)
  const validation = validateImageFile({ type: params.file.type, size })
  if (!validation.valid) throw new Error(validation.error ?? 'Invalid image')

  const derivatives = await generateDerivatives(params.file)

  const basePath = `${params.userId}/${crypto.randomUUID()}`
  const originalExt = extensionForMimeType(params.file.type)
  const derivativeExt = extensionForMimeType(derivatives.outputMimeType)
  const originalPath = `${basePath}/original.${originalExt}`
  const optimizedPath = `${basePath}/optimized.${derivativeExt}`
  const thumbnailPath = `${basePath}/thumbnail.${derivativeExt}`

  const uploadResults = await Promise.all([
    supabase.storage.from(BUCKET).upload(originalPath, params.file, { upsert: false, contentType: params.file.type }),
    supabase.storage
      .from(BUCKET)
      .upload(optimizedPath, derivatives.optimized, { upsert: false, contentType: derivatives.outputMimeType }),
    supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, derivatives.thumbnail, { upsert: false, contentType: derivatives.outputMimeType }),
  ])
  const uploadError = uploadResults.find((result) => result.error)?.error
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('assets')
    .insert({
      workspace_id: params.workspaceId,
      owner_id: params.userId,
      title: params.title?.trim() || params.file.name.replace(/\.[^/.]+$/, ''),
      original_path: originalPath,
      optimized_path: optimizedPath,
      thumbnail_path: thumbnailPath,
      mime_type: params.file.type,
      width: derivatives.natural.width,
      height: derivatives.natural.height,
      size_bytes: size,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** UX-13.8.2 — "serve optimized versions": the assets bucket is private (same reasoning as documents), so display goes through a short-lived signed URL rather than a Blob download — the right choice for something rendered in an <img> tag, where the browser's own HTTP cache should do the work. */
export async function getAssetSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

export async function getAsset(id: string): Promise<Asset> {
  const { data, error } = await supabase.from('assets').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function renameAsset(id: string, title: string): Promise<Asset> {
  const { data, error } = await supabase.from('assets').update({ title }).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Multimodal Intelligence v1 — persists the "Analyze with NOVA" result. */
export async function updateAssetMetadata(id: string, metadata: AssetAnalysis): Promise<Asset> {
  const { data, error } = await supabase.from('assets').update({ metadata }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAsset(asset: Pick<Asset, 'id' | 'original_path' | 'optimized_path' | 'thumbnail_path'>): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([asset.original_path, asset.optimized_path, asset.thumbnail_path])
  if (storageError) throw storageError

  const { error } = await supabase.from('assets').delete().eq('id', asset.id)
  if (error) throw error
}
