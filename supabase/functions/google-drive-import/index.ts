// Supabase Edge Function (Deno) — Import from Google Drive: file import.
// Given a Drive file id the caller selected via the Google Picker
// (client-side; this function never sees a client-supplied Google access
// token), downloads the file server-side using a fresh access token
// minted from the caller's own stored refresh_token
// (google_drive_connections, service-role-only table), then runs it
// through EXACTLY the same document-creation shape
// src/modules/library/api/documents.ts's uploadDocument() already
// produces — same storage bucket/path convention, same `documents`
// insert shape, same enforce_storage_quota() trigger (0046), which fires
// on this insert regardless of role, so a Drive import cannot bypass the
// quota an ordinary upload would hit. No second document-processing
// architecture is introduced.
//
// Deploy: supabase functions deploy google-drive-import
// Secrets required: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
// (same OAuth client as google-drive-oauth).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } })
}

// Mirrors src/modules/library/utils/fileTypes.ts's EXTENSION_TO_FILE_TYPE
// exactly (kept in sync by hand — this is Deno code, it cannot import the
// Vite-built frontend module directly). Any change to what the ingestion
// pipeline supports must update both.
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'epub', 'docx', 'txt', 'md', 'markdown', 'xlsx', 'csv', 'ods'])

// Google-native document types this pipeline can safely produce a
// supported file for, via Drive's own export endpoint. Google Slides
// (application/vnd.google-apps.presentation) is deliberately absent —
// there is no pptx (or any presentation format) in the existing ingestion
// pipeline's supported set, so exporting Slides would either silently
// mislabel a file type or create a document ARRIYIA cannot process. Any
// other Google-native type (forms, drawings, sites, etc.) is equally
// unsupported for the same reason.
const GOOGLE_NATIVE_EXPORTS: Record<string, { exportMimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  },
  'application/vnd.google-apps.spreadsheet': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
}

// Mirrors sanitizeStorageFilename() in src/modules/library/utils/fileTypes.ts.
function sanitizeStorageFilename(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function extensionOf(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : ''
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret) {
    return jsonResponse({ error: 'Google Drive import is not configured for this environment' }, 501)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const { fileId, fileName, mimeType, collectionId, workspaceId } = (body ?? {}) as {
    fileId?: unknown
    fileName?: unknown
    mimeType?: unknown
    collectionId?: unknown
    workspaceId?: unknown
  }
  if (typeof fileId !== 'string' || !fileId || typeof fileName !== 'string' || !fileName || typeof mimeType !== 'string' || !mimeType) {
    return jsonResponse({ error: 'Missing fileId, fileName, or mimeType' }, 400)
  }

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  // Resolve what we're actually going to download and what extension the
  // resulting ARRIYIA document will have, BEFORE touching Drive or
  // storage at all — an unsupported file is rejected immediately, never
  // silently, and never after a partial upload.
  let downloadUrl: string
  let resultExtension: string
  let resultTitle: string
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    const exportInfo = GOOGLE_NATIVE_EXPORTS[mimeType]
    if (!exportInfo) {
      return jsonResponse(
        {
          error: 'unsupported_file_type',
          message:
            mimeType === 'application/vnd.google-apps.presentation'
              ? "Google Slides isn't supported yet — ARRIYIA can't process presentation files."
              : "This Google file type isn't supported for import yet.",
        },
        422,
      )
    }
    downloadUrl = `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportInfo.exportMimeType)}`
    resultExtension = exportInfo.extension
    resultTitle = fileName // Drive's own Google-native names never carry a file extension.
  } else {
    const ext = extensionOf(fileName)
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return jsonResponse({ error: 'unsupported_file_type', message: `Files of type ".${ext || '?'}" aren't supported yet.` }, 422)
    }
    downloadUrl = `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`
    resultExtension = ext
    resultTitle = fileName.replace(/\.[^/.]+$/, '')
  }

  // Dedup: the same Drive file already imported by this same user returns
  // the existing document instead of creating a duplicate.
  const { data: existing } = await serviceClient
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', 'google_drive')
    .eq('source_file_id', fileId)
    .maybeSingle()
  if (existing) {
    return jsonResponse({ outcome: 'already_imported', document: existing }, 200)
  }

  // Mint a fresh access token from the caller's own stored refresh_token
  // — never trust or accept an access token from the client for this step.
  const { data: connection } = await serviceClient
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!connection) {
    return jsonResponse({ error: 'not_connected', message: 'Google Drive is not connected.' }, 409)
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  const tokenBody = (await tokenRes.json().catch(() => null)) as GoogleTokenResponse | null

  if (!tokenRes.ok || !tokenBody?.access_token) {
    // A refresh token can be invalidated externally (the user revoked
    // access in their Google Account, or Google expired it). Clear the
    // now-useless stored connection so the client's own connection-status
    // check correctly reports "not connected" and offers reconnect,
    // rather than repeatedly failing against a dead token.
    await serviceClient.from('google_drive_connections').delete().eq('user_id', user.id)
    console.error('google-drive-import: refresh token exchange failed:', tokenRes.status, JSON.stringify(tokenBody))
    return jsonResponse({ error: 'authorization_expired', message: 'Your Google Drive authorization has expired. Please reconnect.' }, 401)
  }

  const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${tokenBody.access_token}` } })
  if (!fileRes.ok) {
    const status = fileRes.status === 403 || fileRes.status === 404 ? 403 : 502
    return jsonResponse(
      { error: 'drive_download_failed', message: fileRes.status === 404 ? 'That file could not be found in Google Drive.' : "ARRIYIA doesn't have permission to read that file." },
      status,
    )
  }
  const fileBytes = new Uint8Array(await fileRes.arrayBuffer())

  const storageFileName = `${sanitizeStorageFilename(resultTitle)}.${resultExtension}`
  const storagePath = `${user.id}/${crypto.randomUUID()}-${storageFileName}`

  const { error: uploadError } = await serviceClient.storage
    .from('documents')
    .upload(storagePath, fileBytes, { upsert: false, contentType: fileRes.headers.get('content-type') ?? undefined })
  if (uploadError) {
    console.error('google-drive-import: storage upload failed:', uploadError)
    // #21 Phase 5 — categorized 'system' rather than 'documents': this is a
    // failure of the external Google Drive import pipeline/storage layer
    // itself, distinct from the local upload processing pipeline that
    // reports 'documents' category events via
    // report_document_processing_failure. Best-effort, awaited so it
    // completes before the response is sent.
    try {
      await serviceClient.rpc('report_system_health_event', {
        p_severity: 'error',
        p_category: 'system',
        p_operation: 'google_drive_import_storage_upload',
        p_message: uploadError.message,
        p_user_id: user.id,
        p_provider: 'google_drive',
        p_metadata: { file_id: fileId, file_name: fileName },
      })
    } catch (reportErr) {
      console.error('google-drive-import: failed to report system_health_event:', reportErr)
    }
    return jsonResponse({ error: 'upload_failed', message: 'Failed to store the imported file.' }, 500)
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from('documents')
    .insert({
      user_id: user.id,
      collection_id: typeof collectionId === 'string' ? collectionId : null,
      workspace_id: typeof workspaceId === 'string' ? workspaceId : null,
      title: resultTitle,
      file_name: storageFileName,
      file_path: storagePath,
      file_type: resultExtension === 'md' ? 'markdown' : resultExtension,
      file_size: fileBytes.byteLength,
      source: 'google_drive',
      source_file_id: fileId,
      source_metadata: { mimeType, driveFileName: fileName },
      imported_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    await serviceClient.storage.from('documents').remove([storagePath])
    // Same translated shape UploadDropzone.tsx already recognizes for an
    // ordinary upload (STORAGE_QUOTA_ERROR_MARKER) — a Drive import must
    // surface the identical, already-understood error, not a new one.
    if (insertError.message.includes('Storage quota exceeded')) {
      return jsonResponse({ error: 'storage_quota_exceeded', message: insertError.message }, 413)
    }
    console.error('google-drive-import: document insert failed:', insertError)
    return jsonResponse({ error: 'import_failed', message: 'Failed to import this file.' }, 500)
  }

  return jsonResponse({ outcome: 'imported', document: inserted }, 200)
})
