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

    it('resolves the picked file', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      stubGoogleForPicker((cb) => cb({ action: 'picked', docs: [{ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' }] }))

      const result = await pickGoogleDriveFile()
      expect(result).toEqual({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' })
    })

    it('resolves null when the picker is cancelled', async () => {
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id')
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'api-key')
      stubGoogleForPicker((cb) => cb({ action: 'cancel' }))

      const result = await pickGoogleDriveFile()
      expect(result).toBeNull()
    })
  })

  describe('importGoogleDriveFile', () => {
    it('sends the picked file through the google-drive-import function', async () => {
      invokeMock.mockResolvedValueOnce({
        data: { outcome: 'imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } },
        error: null,
      })

      const result = await importGoogleDriveFile(
        { id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' },
        { collectionId: 'col-1', workspaceId: 'ws-1' },
      )

      expect(invokeMock).toHaveBeenCalledWith('google-drive-import', {
        body: { fileId: 'file-1', fileName: 'Notes.pdf', mimeType: 'application/pdf', collectionId: 'col-1', workspaceId: 'ws-1' },
      })
      expect(result.outcome).toBe('imported')
    })

    it('surfaces already_imported without treating it as an error', async () => {
      invokeMock.mockResolvedValueOnce({
        data: { outcome: 'already_imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } },
        error: null,
      })

      const result = await importGoogleDriveFile({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf' })
      expect(result.outcome).toBe('already_imported')
    })
  })
})
