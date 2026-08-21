import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import type { DocumentRow } from '@/shared/types/database'

/**
 * Import from Google Drive — client-side integration. Reuses Google
 * Identity Services (GIS) for OAuth and the Google Picker API for file
 * selection; the actual download/import happens server-side (see
 * supabase/functions/google-drive-import), so this module never sees or
 * stores a long-lived credential — the two access tokens it does touch
 * (the code-flow exchange's result, and the Picker's own transient
 * token) either never leave the browser (Picker token) or are sent once
 * to google-drive-oauth and never returned (the authorization code).
 *
 * Scope is `drive.file` — Google's least-privilege scope for "the app can
 * only see files the user explicitly picked through Picker," never a
 * blanket read of the user's whole Drive (`drive.readonly` would grant
 * that; deliberately not used here).
 */

// Read lazily (not hoisted to a module-level constant) so this reflects
// the actual current env on every call — both in production (where it
// never changes at runtime anyway) and in tests, which stub these via
// vi.stubEnv per-test rather than at module-import time.
function googleOAuthClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined
}
function googleApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
}
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export function isGoogleDriveImportConfigured(): boolean {
  return Boolean(googleOAuthClientId() && googleApiKey())
}

export interface GoogleDriveConnectionStatus {
  connected: boolean
  connectedAt: string | null
}

export async function getGoogleDriveConnectionStatus(): Promise<GoogleDriveConnectionStatus> {
  const { data, error } = await supabase.rpc('get_google_drive_connection_status')
  if (error) throw error
  const row = data?.[0] as { connected: boolean; connected_at: string | null } | undefined
  return { connected: Boolean(row?.connected), connectedAt: row?.connected_at ?? null }
}

export async function disconnectGoogleDrive(): Promise<void> {
  const { error } = await supabase.rpc('disconnect_google_drive')
  if (error) throw error
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-arriyia-src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.arriyiaSrc = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

// deno-lint-ignore no-explicit-any
type GoogleGlobal = any

function googleGlobal(): GoogleGlobal | undefined {
  return (window as unknown as { google?: GoogleGlobal }).google
}

async function ensureGoogleIdentityServices(): Promise<GoogleGlobal> {
  if (!googleGlobal()?.accounts?.oauth2) {
    await loadScriptOnce('https://accounts.google.com/gsi/client')
  }
  const google = googleGlobal()
  if (!google?.accounts?.oauth2) throw new Error('Google sign-in could not be loaded')
  return google
}

async function ensureGooglePicker(): Promise<GoogleGlobal> {
  if (!googleGlobal()?.picker) {
    await loadScriptOnce('https://apis.google.com/js/api.js')
    const gapi = (window as unknown as { gapi?: { load: (name: string, opts: { callback: () => void; onerror: () => void }) => void } }).gapi
    if (!gapi) throw new Error('Google Picker could not be loaded')
    await new Promise<void>((resolve, reject) => {
      gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('Google Picker could not be loaded')) })
    })
  }
  const google = googleGlobal()
  if (!google?.picker) throw new Error('Google Picker could not be loaded')
  return google
}

async function translateFunctionsError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { error?: string; message?: string } | null
    return new Error(body?.message ?? body?.error ?? error.message)
  }
  return error instanceof Error ? error : new Error('Google Drive request failed')
}

/**
 * Runs the OAuth code flow (popup) and completes it server-side via
 * google-drive-oauth. Throws GoogleDriveAuthCancelledError if the user
 * closes the popup / denies access, so callers can distinguish a genuine
 * cancellation from a real failure.
 */
export class GoogleDriveAuthCancelledError extends Error {
  constructor() {
    super('Google Drive authorization was cancelled')
    this.name = 'GoogleDriveAuthCancelledError'
  }
}

export async function connectGoogleDrive(): Promise<void> {
  const clientId = googleOAuthClientId()
  if (!clientId) throw new Error('Google Drive import is not configured')
  const google = await ensureGoogleIdentityServices()

  const code = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      ux_mode: 'popup',
      // offline + consent guarantee a refresh_token on every connect (see
      // the edge function's own header comment for why that matters).
      access_type: 'offline',
      prompt: 'consent',
      callback: (response: { code?: string; error?: string }) => {
        if (response.error) reject(new GoogleDriveAuthCancelledError())
        else if (response.code) resolve(response.code)
        else reject(new Error('Google did not return an authorization code'))
      },
      error_callback: () => reject(new GoogleDriveAuthCancelledError()),
    })
    client.requestCode()
  })

  const { data, error } = await supabase.functions.invoke<{ connected: boolean }>('google-drive-oauth', { body: { code } })
  if (error) throw await translateFunctionsError(error)
  if (!data?.connected) throw new Error('Google Drive connection did not complete')
}

export interface PickedDriveFile {
  id: string
  name: string
  mimeType: string
}

/** Resolves `null` if the user cancels the picker (a normal, non-error outcome). */
export async function pickGoogleDriveFile(): Promise<PickedDriveFile | null> {
  const clientId = googleOAuthClientId()
  const apiKey = googleApiKey()
  if (!clientId || !apiKey) throw new Error('Google Drive import is not configured')
  const google = await ensureGoogleIdentityServices()

  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.error) reject(new GoogleDriveAuthCancelledError())
        else if (response.access_token) resolve(response.access_token)
        else reject(new Error('Google did not return an access token'))
      },
      error_callback: () => reject(new GoogleDriveAuthCancelledError()),
    })
    client.requestAccessToken()
  })

  const pickerGoogle = await ensureGooglePicker()

  return new Promise((resolve, reject) => {
    try {
      const picker = new pickerGoogle.picker.PickerBuilder()
        .addView(pickerGoogle.picker.ViewId.DOCS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data: { action: string; docs?: { id: string; name: string; mimeType: string }[] }) => {
          if (data.action === pickerGoogle.picker.Action.PICKED && data.docs?.[0]) {
            const doc = data.docs[0]
            resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType })
          } else if (data.action === pickerGoogle.picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()
      picker.setVisible(true)
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Google Picker failed to open'))
    }
  })
}

export interface GoogleDriveImportResult {
  outcome: 'imported' | 'already_imported'
  document: DocumentRow
}

export async function importGoogleDriveFile(
  file: PickedDriveFile,
  opts: { collectionId?: string | null; workspaceId?: string | null } = {},
): Promise<GoogleDriveImportResult> {
  const { data, error } = await supabase.functions.invoke<GoogleDriveImportResult>('google-drive-import', {
    body: { fileId: file.id, fileName: file.name, mimeType: file.mimeType, ...opts },
  })
  if (error) throw await translateFunctionsError(error)
  if (!data) throw new Error('Import did not return a result')
  return data
}
