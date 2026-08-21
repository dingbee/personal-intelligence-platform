import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const {
  uploadMutateAsync,
  importFromGoogleDriveMutateAsync,
  isGoogleDriveImportConfiguredMock,
  getGoogleDriveConnectionStatusMock,
  connectGoogleDriveMock,
  pickGoogleDriveFileMock,
  GoogleDriveAuthCancelledErrorStub,
} = vi.hoisted(() => {
  class GoogleDriveAuthCancelledErrorStub extends Error {
    constructor() {
      super('cancelled')
      this.name = 'GoogleDriveAuthCancelledError'
    }
  }
  return {
    uploadMutateAsync: vi.fn(),
    importFromGoogleDriveMutateAsync: vi.fn(),
    isGoogleDriveImportConfiguredMock: vi.fn(),
    getGoogleDriveConnectionStatusMock: vi.fn(),
    connectGoogleDriveMock: vi.fn(),
    pickGoogleDriveFileMock: vi.fn(),
    GoogleDriveAuthCancelledErrorStub,
  }
})

vi.mock('@/modules/library/hooks/useDocumentMutations', () => ({
  useDocumentMutations: () => ({
    upload: { mutateAsync: uploadMutateAsync },
    importFromGoogleDrive: { mutateAsync: importFromGoogleDriveMutateAsync },
  }),
}))

vi.mock('@/modules/library/api/googleDrive', () => ({
  GoogleDriveAuthCancelledError: GoogleDriveAuthCancelledErrorStub,
  isGoogleDriveImportConfigured: isGoogleDriveImportConfiguredMock,
  getGoogleDriveConnectionStatus: getGoogleDriveConnectionStatusMock,
  connectGoogleDrive: connectGoogleDriveMock,
  pickGoogleDriveFile: pickGoogleDriveFileMock,
}))

import { UploadDropzone } from '@/modules/library/components/UploadDropzone'

function renderDropzone() {
  return render(createElement(MemoryRouter, null, createElement(UploadDropzone, { collectionId: null })))
}

afterEach(cleanup)

describe('UploadDropzone — Google Drive import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show the Drive import affordance when it is not configured', () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(false)
    renderDropzone()
    expect(screen.queryByRole('button', { name: /import from google drive/i })).toBeNull()
  })

  it('shows the Drive import affordance when configured', () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    renderDropzone()
    expect(screen.getByRole('button', { name: /import from google drive/i })).not.toBeNull()
  })

  it('connects, picks, and imports a file end to end, showing it as done', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: false, connectedAt: null })
    connectGoogleDriveMock.mockResolvedValueOnce(undefined)
    pickGoogleDriveFileMock.mockResolvedValueOnce({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'picker-token-1' })
    importFromGoogleDriveMutateAsync.mockResolvedValueOnce({ outcome: 'imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } })

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(screen.getByText('Uploaded')).not.toBeNull())
    expect(connectGoogleDriveMock).toHaveBeenCalledTimes(1)
    expect(importFromGoogleDriveMutateAsync).toHaveBeenCalledWith({
      file: { id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'picker-token-1' },
      collectionId: null,
    })
  })

  it('skips the OAuth popup when already connected', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: true, connectedAt: '2026-08-01T00:00:00Z' })
    pickGoogleDriveFileMock.mockResolvedValueOnce({ id: 'file-1', name: 'Notes.pdf', mimeType: 'application/pdf', accessToken: 'picker-token-1' })
    importFromGoogleDriveMutateAsync.mockResolvedValueOnce({ outcome: 'imported', document: { id: 'doc-1', file_name: 'Notes.pdf' } })

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(screen.getByText('Uploaded')).not.toBeNull())
    expect(connectGoogleDriveMock).not.toHaveBeenCalled()
  })

  it('silently does nothing when the user cancels the picker', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: true, connectedAt: '2026-08-01T00:00:00Z' })
    pickGoogleDriveFileMock.mockResolvedValueOnce(null)

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(getGoogleDriveConnectionStatusMock).toHaveBeenCalled())
    expect(screen.queryByText('Uploaded')).toBeNull()
    expect(screen.queryByText(/error/i)).toBeNull()
    expect(importFromGoogleDriveMutateAsync).not.toHaveBeenCalled()
  })

  it('silently does nothing when the OAuth popup is cancelled', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: false, connectedAt: null })
    connectGoogleDriveMock.mockRejectedValueOnce(new GoogleDriveAuthCancelledErrorStub())

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(connectGoogleDriveMock).toHaveBeenCalled())
    expect(pickGoogleDriveFileMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/error/i)).toBeNull()
  })

  it('shows an upgrade CTA when the import fails on storage quota', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: true, connectedAt: '2026-08-01T00:00:00Z' })
    pickGoogleDriveFileMock.mockResolvedValueOnce({ id: 'file-1', name: 'Big.pdf', mimeType: 'application/pdf', accessToken: 'picker-token-1' })
    importFromGoogleDriveMutateAsync.mockRejectedValueOnce(new Error('Storage quota exceeded: this upload would use 999 bytes of your 100 byte limit.'))

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(screen.getByText("You've reached your storage limit.")).not.toBeNull())
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).not.toBeNull()
  })

  it('shows a clear, specific error for an unsupported file type, without creating an item marked done', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: true, connectedAt: '2026-08-01T00:00:00Z' })
    pickGoogleDriveFileMock.mockResolvedValueOnce({ id: 'file-1', name: 'Deck', mimeType: 'application/vnd.google-apps.presentation', accessToken: 'picker-token-1' })
    importFromGoogleDriveMutateAsync.mockRejectedValueOnce(new Error("Google Slides isn't supported yet — ARRIYIA can't process presentation files."))

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(screen.getByText(/Google Slides isn't supported yet/)).not.toBeNull())
    expect(screen.queryByText('Uploaded')).toBeNull()
  })

  it('surfaces a connection failure that is not a cancellation as a visible error', async () => {
    isGoogleDriveImportConfiguredMock.mockReturnValue(true)
    getGoogleDriveConnectionStatusMock.mockResolvedValueOnce({ connected: false, connectedAt: null })
    connectGoogleDriveMock.mockRejectedValueOnce(new Error('Google Drive authorization failed. Please try again.'))

    renderDropzone()
    fireEvent.click(screen.getByRole('button', { name: /import from google drive/i }))

    await waitFor(() => expect(screen.getByText('Google Drive authorization failed. Please try again.')).not.toBeNull())
  })
})
