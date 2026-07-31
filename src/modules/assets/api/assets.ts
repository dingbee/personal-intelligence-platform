import { supabase } from '@/shared/lib/supabase'
import type { Asset } from '@/shared/types/database'
import { validateImageFile } from '@/modules/assets/validation'
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

export async function listAssets(params: { workspaceId?: string | null } = {}): Promise<Asset[]> {
  let query = supabase.from('assets').select('*').order('created_at', { ascending: false })
  if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId)
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
export async function uploadAsset(params: { file: File; userId: string; workspaceId: string | null }): Promise<Asset> {
  const validation = validateImageFile(params.file)
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
      original_path: originalPath,
      optimized_path: optimizedPath,
      thumbnail_path: thumbnailPath,
      mime_type: params.file.type,
      width: derivatives.natural.width,
      height: derivatives.natural.height,
      size_bytes: params.file.size,
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

export async function deleteAsset(asset: Pick<Asset, 'id' | 'original_path' | 'optimized_path' | 'thumbnail_path'>): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([asset.original_path, asset.optimized_path, asset.thumbnail_path])
  if (storageError) throw storageError

  const { error } = await supabase.from('assets').delete().eq('id', asset.id)
  if (error) throw error
}
