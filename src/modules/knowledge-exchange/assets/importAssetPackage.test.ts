import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@/shared/types/database'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'
import { uint8ArrayToBase64 } from '@/modules/knowledge-exchange/assets/base64'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { uploadAssetMock } = vi.hoisted(() => ({ uploadAssetMock: vi.fn() }))

vi.mock('@/modules/assets/api/assets', () => ({
  uploadAsset: uploadAssetMock,
}))

import { assetPackageImporter, importAssetPackage } from '@/modules/knowledge-exchange/assets/importAssetPackage'

function fakeUploadedAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-new',
    workspace_id: 'importer-workspace',
    owner_id: 'importer-1',
    title: 'Sunset over the lake',
    original_path: 'importer-1/asset-new/original.jpg',
    optimized_path: 'importer-1/asset-new/optimized.webp',
    thumbnail_path: 'importer-1/asset-new/thumbnail.webp',
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    size_bytes: 245_000,
    created_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

function fakePackage(overrides: Partial<AssetPackage['asset']> = {}): AssetPackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    asset: {
      title: 'Sunset over the lake',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      sizeBytes: 245_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      fileDataBase64: uint8ArrayToBase64(new Uint8Array([1, 2, 3, 4])),
      ...overrides,
    },
  }
}

describe('importAssetPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls uploadAsset with the importer as owner and the chosen workspace', async () => {
    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset())

    await importAssetPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(uploadAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'importer-1', workspaceId: 'importer-workspace', title: 'Sunset over the lake' }),
    )
  })

  it('supports importing into no workspace (personal)', async () => {
    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset({ workspace_id: null }))

    await importAssetPackage(fakePackage(), { userId: 'importer-1', workspaceId: null })

    expect(uploadAssetMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: null }))
  })

  it('reconstructs a File carrying the decoded original bytes and declared MIME type', async () => {
    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset())
    const originalBytes = new Uint8Array([9, 8, 7, 6, 5])

    await importAssetPackage(fakePackage({ fileDataBase64: uint8ArrayToBase64(originalBytes), mimeType: 'image/png' }), {
      userId: 'importer-1',
      workspaceId: 'importer-workspace',
    })

    const call = uploadAssetMock.mock.calls[0]![0] as { file: File }
    expect(call.file).toBeInstanceOf(File)
    expect(call.file.type).toBe('image/png')
    const buffer = await call.file.arrayBuffer()
    expect(new Uint8Array(buffer)).toEqual(originalBytes)
  })

  it('never trusts or forwards the package to a storage path — uploadAsset generates its own fresh reference', async () => {
    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset())

    await importAssetPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    const call = uploadAssetMock.mock.calls[0]![0] as Record<string, unknown>
    expect(call).not.toHaveProperty('originalPath')
    expect(call).not.toHaveProperty('path')
  })

  it('returns the freshly created asset from uploadAsset', async () => {
    const created = fakeUploadedAsset({ id: 'brand-new-id' })
    uploadAssetMock.mockResolvedValueOnce(created)

    const result = await importAssetPackage(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(created)
  })

  it('the assetPackageImporter object delegates to the same function', async () => {
    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset())
    const result = await assetPackageImporter.import(fakePackage(), { userId: 'importer-1', workspaceId: 'importer-workspace' })
    expect(result.id).toBe('asset-new')
  })
})
