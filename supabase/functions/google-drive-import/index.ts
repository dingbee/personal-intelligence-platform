// Supabase Edge Function (Deno) — Import from Google Drive: file import.
//
// TOKEN HANDOFF FIX — root cause and fix, explicitly documented since this
// is the second time this function's Google-token strategy has mattered:
// this function used to IGNORE any client-supplied Google access token and
// always mint a fresh one from the caller's own stored refresh_token
// (google_drive_connections, service-role-only table, populated by the
// separate google-drive-oauth code-flow). Under `drive.file` — Google's
// least-privilege scope — a token only sees the specific files that were
// visible/picked under THAT SAME OAuth grant; a freshly-minted token from a
// DIFFERENT grant (the stored refresh_token, obtained via a separate
// initCodeClient consent) does not reliably inherit visibility into a file
// the user just picked via a THIRD, transient initTokenClient grant in
// Picker. Production symptom: a file clearly selectable in Picker came
// back "not found" once this function tried to download it with its own
// separately-minted token.
//
// Fix: the caller now forwards the exact transient Picker access token
// that authorized the picked file (`driveAccessToken` in the request
// body — see src/modules/library/api/googleDrive.ts's own header comment).
// This function uses THAT token — and only that token — for the one
// immediate Drive download this request makes. It is never persisted to
// any table, never logged, and never included in any response body; it
// lives only in a local variable for the duration of this request and is
// discarded when the function returns. If it's absent, this function fails
// closed with a clear 401 rather than falling back to a fresh
// refresh-token-minted token — that fallback is exactly the credential
// mismatch this fix closes, so it is never a safe substitute here.
//
// The stored refresh-token connection (google_drive_connections) is
// UNCHANGED and untouched by this function: it remains the source of
// truth for connection state (get_google_drive_connection_status),
// reconnect (google-drive-oauth), and any future background operation
// that isn't tied to one just-picked file in the current session.
//
// Everything downstream of the download — storage upload, `documents`
// insert (same shape src/modules/library/api/documents.ts's
// uploadDocument() produces), enforce_storage_quota() (0046), provenance
// (source/source_file_id/source_metadata), and same-file dedup — is
// unchanged.
//
// Deploy: supabase functions deploy google-drive-import

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  // GOOGLE_OAUTH_CLIENT_ID/SECRET are deliberately NOT required here — this
  // function no longer mints a Google access token itself (see the token
  // handoff fix above); only google-drive-oauth still needs them, for the
  // separate refresh-token code-flow exchange.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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
  const { fileId, fileName, mimeType, driveAccessToken, collectionId, workspaceId } = (body ?? {}) as {
    fileId?: unknown
    fileName?: unknown
    mimeType?: unknown
    driveAccessToken?: unknown
    collectionId?: unknown
    workspaceId?: unknown
  }
  if (typeof fileId !== 'string' || !fileId || typeof fileName !== 'string' || !fileName || typeof mimeType !== 'string' || !mimeType) {
    return jsonResponse({ error: 'Missing fileId, fileName, or mimeType' }, 400)
  }
  // Fail closed rather than falling back to a differently-scoped
  // credential — see the token handoff fix comment above for why that
  // fallback is exactly the bug this closes, not a safe substitute.
  if (typeof driveAccessToken !== 'string' || !driveAccessToken) {
    return jsonResponse(
      { error: 'authorization_expired', message: 'Your Google authorization for this file has expired. Please try importing again.' },
      401,
    )
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

  // Use the caller-supplied Picker access token directly — the exact
  // grant that authorized this file in Picker — for this one immediate
  // download. Never persisted to any table, never logged (not even on
  // failure, where only the response status is logged), never included in
  // the response. `driveAccessToken` goes out of scope and is discarded
  // once this request completes; it is never assigned to any variable
  // that outlives this function invocation.
  const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${driveAccessToken}` } })
  if (!fileRes.ok) {
    // 401/403/404 kept distinct — collapsing them (as this function used
    // to) is exactly what made a real "you don't have access" or
    // "genuinely missing" outcome unreadable as a plain "file not found."
    if (fileRes.status === 401) {
      return jsonResponse(
        { error: 'authorization_expired', message: 'Your Google authorization for this file has expired. Please try importing again.' },
        401,
      )
    }
    if (fileRes.status === 403) {
      return jsonResponse({ error: 'permission_denied', message: "ARRIYIA doesn't have permission to read that file." }, 403)
    }
    if (fileRes.status === 404) {
      return jsonResponse({ error: 'not_found', message: 'That file could not be found in Google Drive.' }, 404)
    }
    console.error('google-drive-import: Drive download failed:', fileRes.status)
    return jsonResponse({ error: 'drive_download_failed', message: 'Google Drive returned an unexpected error while downloading this file.' }, 502)
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
    // completes before the response is sent. Preserved as-is by the token
    // handoff fix — this call never touches driveAccessToken.
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
