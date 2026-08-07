import { describe, expect, it } from 'vitest'
import type { Asset } from '@/shared/types/database'
import { assetPackageExporter, assetPackageFilename, exportAssetPackage } from '@/modules/knowledge-exchange/assets/exportAssetPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    workspace_id: 'exporter-workspace',
    owner_id: 'exporter-1',
    title: 'Sunset over the lake',
    original_path: 'exporter-1/asset-1/original.jpg',
    optimized_path: 'exporter-1/asset-1/optimized.webp',
    thumbnail_path: 'exporter-1/asset-1/thumbnail.webp',
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    size_bytes: 245_000,
    created_at: '2026-01-01T00:00:00.000Z',
    metadata: null,
    ...overrides,
  }
}

describe('exportAssetPackage', () => {
  it('includes correct user-visible metadata', () => {
    const pkg = exportAssetPackage({ asset: fakeAsset(), fileDataBase64: 'ZmFrZS1ieXRlcw==' })

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(pkg.asset).toEqual({
      title: 'Sunset over the lake',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      sizeBytes: 245_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      fileDataBase64: 'ZmFrZS1ieXRlcw==',
    })
  })

  it('embeds the given file bytes verbatim (binary handling decision: Option A)', () => {
    const pkg = exportAssetPackage({ asset: fakeAsset(), fileDataBase64: 'aGVsbG8gd29ybGQ=' })
    expect(pkg.asset.fileDataBase64).toBe('aGVsbG8gd29ybGQ=')
  })

  it('excludes owner_id, workspace_id, id, and every storage path — allow-list only', () => {
    const pkg = exportAssetPackage({ asset: fakeAsset(), fileDataBase64: 'x' })
    const serialized = JSON.stringify(pkg)

    expect(serialized).not.toContain('exporter-1')
    expect(serialized).not.toContain('exporter-workspace')
    expect(serialized).not.toContain('asset-1')
    expect(serialized).not.toContain('original_path')
    expect(serialized).not.toContain('optimized_path')
    expect(serialized).not.toContain('thumbnail_path')
    expect(serialized).not.toContain('.jpg')
    expect(serialized).not.toContain('.webp')
  })

  it('never includes the optimized or thumbnail derivative bytes — only what was explicitly passed as the original', () => {
    const pkg = exportAssetPackage({ asset: fakeAsset(), fileDataBase64: 'only-original-bytes' })
    expect(pkg.asset.fileDataBase64).toBe('only-original-bytes')
    expect(Object.keys(pkg.asset)).not.toContain('optimizedDataBase64')
    expect(Object.keys(pkg.asset)).not.toContain('thumbnailDataBase64')
  })

  it('the assetPackageExporter object delegates to the same function', () => {
    const source = { asset: fakeAsset(), fileDataBase64: 'abc' }
    expect(assetPackageExporter.export(source)).toEqual(exportAssetPackage(source))
  })
})

describe('assetPackageFilename', () => {
  it('slugifies the title into a safe .json filename', () => {
    expect(assetPackageFilename('Sunset over the Lake!')).toBe('sunset-over-the-lake.json')
  })

  it('falls back to a generic name for an empty/symbol-only title', () => {
    expect(assetPackageFilename('   ')).toBe('asset-export.json')
    expect(assetPackageFilename('!!!')).toBe('asset-export.json')
  })
})
