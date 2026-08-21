import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRow } from '@/shared/types/database'
import { buildDocumentPackageZip } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { parseDocumentPackageZip } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import type { ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { uploadDocumentMock, addTagToDocumentMock, processDocumentMock } = vi.hoisted(() => ({
  uploadDocumentMock: vi.fn(),
  addTagToDocumentMock: vi.fn(),
  processDocumentMock: vi.fn(),
}))

vi.mock('@/modules/library/api/documents', () => ({ uploadDocument: uploadDocumentMock }))
vi.mock('@/modules/library/api/tags', () => ({ addTagToDocument: addTagToDocumentMock }))
vi.mock('@/modules/processing/pipeline/processDocument', () => ({ processDocument: processDocumentMock }))

import { documentPackageImporter, importDocumentPackage } from '@/modules/knowledge-exchange/documents/importDocumentPackage'

function fakeManifest(overrides: Partial<DocumentPackageManifest['document']> = {}): DocumentPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    document: {
      title: 'Field Notes',
      fileName: 'field-notes.pdf',
      fileType: 'pdf',
      sizeBytes: 12,
      createdAt: '2026-01-01T00:00:00.000Z',
      tags: ['research', 'fieldwork'],
      ...overrides,
    },
  }
}

async function fakeValidatedPackage(
  overrides: Partial<DocumentPackageManifest['document']> = {},
  content = 'original file bytes',
): Promise<ValidatedDocumentPackage> {
  const manifest = fakeManifest(overrides)
  const zipBlob = await buildDocumentPackageZip(manifest, new Blob([content]))
  const result = await parseDocumentPackageZip(zipBlob)
  if (!result.valid) throw new Error('test setup produced an invalid package')
  return result.package
}

function fakeUploadedDocument(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'new-doc-1',
    user_id: 'importer-1',
    workspace_id: 'importer-workspace',
    collection_id: null,
    title: 'Field Notes',
    file_name: 'Field Notes.pdf',
    file_path: 'importer-1/new-doc-1-Field-Notes.pdf',
    file_type: 'pdf',
    file_size: 20,
    status: 'uploaded',
    source: 'upload',
    source_file_id: null,
    source_metadata: {},
    imported_at: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('importDocumentPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls uploadDocument with the importer as owner, the chosen workspace, no collection, and a File reconstructed from the manifest title + correct extension', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument())
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(uploadDocumentMock).toHaveBeenCalledTimes(1)
    const call = uploadDocumentMock.mock.calls[0]![0] as {
      file: File
      userId: string
      collectionId: string | null
      workspaceId: string | null
    }
    expect(call.userId).toBe('importer-1')
    expect(call.workspaceId).toBe('importer-workspace')
    expect(call.collectionId).toBeNull()
    expect(call.file).toBeInstanceOf(File)
    expect(call.file.name).toBe('Field Notes.pdf')
  })

  it('the reconstructed File carries the exact original bytes', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument())
    const validated = await fakeValidatedPackage({}, 'exact original content check')

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = uploadDocumentMock.mock.calls[0]![0] as { file: File }
    expect(await call.file.text()).toBe('exact original content check')
  })

  it('picks the extension matching the manifest fileType, even for markdown (md, not markdown)', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument({ file_type: 'markdown' }))
    const validated = await fakeValidatedPackage({ fileType: 'markdown', title: 'Journal' })

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = uploadDocumentMock.mock.calls[0]![0] as { file: File }
    expect(call.file.name).toBe('Journal.md')
  })

  it('supports importing into no workspace (personal)', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument({ workspace_id: null }))
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: null })

    expect(uploadDocumentMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: null }))
  })

  it('re-resolves every tag by name via addTagToDocument, in the importer own account', async () => {
    const created = fakeUploadedDocument()
    uploadDocumentMock.mockResolvedValueOnce(created)
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(addTagToDocumentMock).toHaveBeenCalledTimes(2)
    expect(addTagToDocumentMock).toHaveBeenCalledWith({ documentId: created.id, tagName: 'research', userId: 'importer-1' })
    expect(addTagToDocumentMock).toHaveBeenCalledWith({ documentId: created.id, tagName: 'fieldwork', userId: 'importer-1' })
  })

  it('never adds tags when the package has none', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument())
    const validated = await fakeValidatedPackage({ tags: [] })

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(addTagToDocumentMock).not.toHaveBeenCalled()
  })

  it('fires processDocument for the freshly created document, as the importer', async () => {
    const created = fakeUploadedDocument({ id: 'brand-new-id' })
    uploadDocumentMock.mockResolvedValueOnce(created)
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(processDocumentMock).toHaveBeenCalledWith('brand-new-id', 'importer-1')
  })

  it('never calls processDocument before uploadDocument resolves -- ordering, not just occurrence', async () => {
    const callOrder: string[] = []
    uploadDocumentMock.mockImplementationOnce(async () => {
      callOrder.push('upload')
      return fakeUploadedDocument()
    })
    processDocumentMock.mockImplementationOnce(() => {
      callOrder.push('process')
      return Promise.resolve()
    })
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(callOrder).toEqual(['upload', 'process'])
  })

  it('returns the freshly created document row', async () => {
    const created = fakeUploadedDocument({ id: 'the-created-one' })
    uploadDocumentMock.mockResolvedValueOnce(created)
    const validated = await fakeValidatedPackage()

    const result = await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(created)
  })

  it('never trusts or forwards a storage path from the package -- uploadDocument generates its own fresh reference', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument())
    const validated = await fakeValidatedPackage()

    await importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = uploadDocumentMock.mock.calls[0]![0] as Record<string, unknown>
    expect(call).not.toHaveProperty('filePath')
    expect(call).not.toHaveProperty('path')
  })

  it('the documentPackageImporter object delegates to the same function', async () => {
    uploadDocumentMock.mockResolvedValueOnce(fakeUploadedDocument())
    const validated = await fakeValidatedPackage()

    const result = await documentPackageImporter.import(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result.id).toBe('new-doc-1')
  })

  it('propagates an upload failure without attaching tags or firing processDocument -- no partial import', async () => {
    uploadDocumentMock.mockRejectedValueOnce(new Error('Unsupported file type: imported-document.exe'))
    const validated = await fakeValidatedPackage()

    await expect(
      importDocumentPackage(validated, { userId: 'importer-1', workspaceId: 'importer-workspace' }),
    ).rejects.toThrow('Unsupported file type')

    expect(addTagToDocumentMock).not.toHaveBeenCalled()
    expect(processDocumentMock).not.toHaveBeenCalled()
  })

  it('throws a clear error rather than uploading if the original entry is somehow missing from the zip', async () => {
    const validated = await fakeValidatedPackage()
    const brokenPackage: ValidatedDocumentPackage = { manifest: validated.manifest, zip: new JSZip() }

    await expect(importDocumentPackage(brokenPackage, { userId: 'importer-1', workspaceId: 'importer-workspace' })).rejects.toThrow(
      'missing its document content',
    )
    expect(uploadDocumentMock).not.toHaveBeenCalled()
  })
})
