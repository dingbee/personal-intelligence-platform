import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Import from Google Drive — client integration tests. Script loading
 * (GIS/Picker) is bypassed by pre-seeding `window.google`/`window.gapi`
 * directly, matching how a real page behaves once those scripts have
 * already loaded — this keeps the tests focused on this module's own
 * logic (config detection, token-flow wiring, error translation, cancel
 * handling) rather than re-testing that <script> tags load.
 */

const { rpcMock, invokeMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  invokeMock: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, functions: { invoke: invokeMock } } }))

import {
  GoogleDriveAuthCancelledError,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveConnectionStatus,
  importGoogleDriveFile,
  isGoogleDriveImportConfigured,
  pickGoogleDriveFile,
} from '@/modules/library/api/googleDrive'

describe('googleDrive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    delete (window as unknown as { google?: unknown }).google
    delete (window as unknown as { gapi?: unknown }).gapi
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('isGoogleDriveImportConfigured', () => {
    it('is false when neither env var is set', () => {
      expect(isGoogleDriveImportConfigured()).toBe(false)
    })

    it('is false when only the client id is set', () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      expect(isGoogleDriveImportConfigured()).toBe(false)
    })

    it('is true when both the client id and API key are set', () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      expect(isGoogleDriveImportConfigured()).toBe(true)
    })
  })

  describe('getGoogleDriveConnectionStatus', () => {
    it('reports connected with a timestamp', async () => {
      rpcMock.mockResolvedValueOnce({ data: [{ connected: true, connected_at: '2026-08-01T00:00:00Z' }], error: null })
      const status = await getGoogleDriveConnectionStatus()
      expect(rpcMock).toHaveBeenCalledWith('get_google_drive_connection_status')
      expect(status).toEqual({ connected: true, connectedAt: '2026-08-01T00:00:00Z' })
    })

    it('reports not connected when no row exists', async () => {
      rpcMock.mockResolvedValueOnce({ data: [{ connected: false, connected_at: null }], error: null })
      const status = await getGoogleDriveConnectionStatus()
      expect(status).toEqual({ connected: false, connectedAt: null })
    })

    it('throws on an RPC error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })
      await expect(getGoogleDriveConnectionStatus()).rejects.toThrow('boom')
    })
  })

  describe('disconnectGoogleDrive', () => {
    it('calls the disconnect RPC', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null })
      await disconnectGoogleDrive()
      expect(rpcMock).toHaveBeenCalledWith('disconnect_google_drive')
    })
  })

  describe('connectGoogleDrive', () => {
    it('throws a clear error when not configured', async () => {
      await expect(connectGoogleDrive()).rejects.toThrow('Google Drive import is not configured')
    })

    it('exchanges the authorization code via the google-drive-oauth function', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      let capturedConfig: { callback: (r: { code?: string; error?: string }) => void } | undefined
      ;(window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initCodeClient: (config: typeof capturedConfig) => {
              capturedConfig = config
              return { requestCode: () => capturedConfig!.callback({ code: 'auth-code-123' }) }
            },
          },
        },
      }
      invokeMock.mockResolvedValueOnce({ data: { connected: true }, error: null })

      await connectGoogleDrive()

      expect(invokeMock).toHaveBeenCalledWith('google-drive-oauth', { body: { code: 'auth-code-123' } })
    })

    it('throws GoogleDriveAuthCancelledError when the popup is dismissed', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      ;(window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initCodeClient: (config: { callback: (r: { error?: string }) => void }) => ({
              requestCode: () => config.callback({ error: 'access_denied' }),
            }),
          },
        },
      }

      await expect(connectGoogleDrive()).rejects.toBeInstanceOf(GoogleDriveAuthCancelledError)
      expect(invokeMock).not.toHaveBeenCalled()
    })
  })

  describe('pickGoogleDriveFile', () => {
    function stubGoogleForPicker(onPicked: (cb: (data: unknown) => void) => void) {
      ;(window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: { callback: (r: { access_token?: string }) => void }) => ({
              requestAccessToken: () => config.callback({ access_token: 'access-token-abc' }),
            }),
          },
        },
        picker: {
          ViewId: { DOCS: 'DOCS' },
          Action: { PICKED: 'picked', CANCEL: 'cancel' },
          PickerBuilder: class {
            private cb: ((data: unknown) => void) | undefined
            addView() {
              return this
            }
            setOAuthToken() {
              return this
            }
            setDeveloperKey() {
              return this
            }
            setAppId() {
              return this
            }
            setCallback(cb: (data: unknown) => void) {
              this.cb = cb
              return this
            }
            build() {
              return { setVisible: () => onPicked(this.cb!) }
            }
          },
        },
      }
    }

    it('throws a clear error when not configured', async () => {
      await expect(pickGoogleDriveFile()).rejects.toThrow('Google Drive import is not configured')
    })

    it('resolves the picked file together with the exact Picker access token that authorized it', async () => {
      // Token handoff fix — the Picker access token (from initTokenClient,
      // the transient grant that actually authorized this specific file
      // under drive.file) must travel with the picked file, not be
      // discarded after Picker closes. Previously only {id, name,
      // mimeType} was returned, which is what let google-drive-import
      // silently mint a DIFFERENT, differently-scoped token later.
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      stubGoogleForPicker((cb) => cb({ action: 'picked', docs: [{ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' }] }))

      const result = await pickGoogleDriveFile()
      expect(result).toEqual({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'access-token-abc' })
    })

    it('resolves null when the picker is cancelled', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      stubGoogleForPicker((cb) => cb({ action: 'cancel' }))

      const result = await pickGoogleDriveFile()
      expect(result).toBeNull()
    })

    it('configures the Picker with setAppId using the Cloud project number from the OAuth client id (required for drive.file to actually grant file access, not just let the user browse/select)', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', '123456789-abcxyz.apps.googleusercontent.com')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      const setAppIdSpy = vi.fn()
      ;(window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: { callback: (r: { access_token?: string }) => void }) => ({
              requestAccessToken: () => config.callback({ access_token: 'access-token-abc' }),
            }),
          },
        },
        picker: {
          ViewId: { DOCS: 'DOCS' },
          Action: { PICKED: 'picked', CANCEL: 'cancel' },
          PickerBuilder: class {
            private cb: ((data: unknown) => void) | undefined
            addView() {
              return this
            }
            setOAuthToken() {
              return this
            }
            setDeveloperKey() {
              return this
            }
            setAppId(appId: string) {
              setAppIdSpy(appId)
              return this
            }
            setCallback(cb: (data: unknown) => void) {
              this.cb = cb
              return this
            }
            build() {
              return { setVisible: () => this.cb!({ action: 'picked', docs: [{ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' }] }) }
            }
          },
        },
      }

      await pickGoogleDriveFile()
      expect(setAppIdSpy).toHaveBeenCalledWith('123456789')
    })
  })

  describe('importGoogleDriveFile', () => {
    it('sends the picked file, INCLUDING its Picker access token as driveAccessToken, through the google-drive-import function', async () => {
      invokeMock.mockResolvedValueOnce({
        data: { outcome: 'imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } },
        error: null,
      })

      const result = await importGoogleDriveFile(
        { id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'access-token-abc' },
        { collectionId: 'col-1', workspaceId: 'ws-1' },
      )

      expect(invokeMock).toHaveBeenCalledWith('google-drive-import', {
        body: {
          fileId: 'file-1',
          fileName: 'Notes.pdf',
          mimeType: 'application/pdf',
          driveAccessToken: 'access-token-abc',
          collectionId: 'col-1',
          workspaceId: 'ws-1',
        },
      })
      expect(result.outcome).toBe('imported')
    })

    it('surfaces already_imported without treating it as an error', async () => {
      invokeMock.mockResolvedValueOnce({
        data: { outcome: 'already_imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } },
        error: null,
      })

      const result = await importGoogleDriveFile({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'access-token-abc' })
      expect(result.outcome).toBe('already_imported')
    })
  })

  /**
   * Token handoff fix (regression) — end-to-end proof that the SAME
   * transient access token Picker used to authorize the selected file is
   * the one that reaches google-drive-import, with nothing in between
   * substituting a different credential. This is the exact call chain
   * UploadDropzone.tsx drives: pickGoogleDriveFile() -> pass its result
   * straight into importGoogleDriveFile().
   */
  describe('Picker-to-importer token handoff (regression)', () => {
    it('the exact access token Picker used to authorize the file reaches google-drive-import as driveAccessToken', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      ;(window as unknown as { google: unknown }).google = {
        accounts: {
          oauth2: {
            initTokenClient: (config: { callback: (r: { access_token?: string }) => void }) => ({
              requestAccessToken: () => config.callback({ access_token: 'the-specific-grant-that-picked-this-file' }),
            }),
          },
        },
        picker: {
          ViewId: { DOCS: 'DOCS' },
          Action: { PICKED: 'picked', CANCEL: 'cancel' },
          PickerBuilder: class {
            private cb: ((data: unknown) => void) | undefined
            addView() {
              return this
            }
            setOAuthToken() {
              return this
            }
            setDeveloperKey() {
              return this
            }
            setAppId() {
              return this
            }
            setCallback(cb: (data: unknown) => void) {
              this.cb = cb
              return this
            }
            build() {
              return {
                setVisible: () =>
                  this.cb!({ action: 'picked', docs: [{ id: 'file-1', name: 'Report.pdf', mimeType: 'application/pdf' }] }),
              }
            }
          },
        },
      }
      invokeMock.mockResolvedValueOnce({
        data: { outcome: 'imported', document: { id: 'doc-1', file_name: 'Report.pdf' } },
        error: null,
      })

      const picked = await pickGoogleDriveFile()
      expect(picked).not.toBeNull()
      await importGoogleDriveFile(picked!, {})

      expect(invokeMock).toHaveBeenCalledWith(
        'google-drive-import',
        expect.objectContaining({ body: expect.objectContaining({ driveAccessToken: 'the-specific-grant-that-picked-this-file' }) }),
      )
    })
  })
})
