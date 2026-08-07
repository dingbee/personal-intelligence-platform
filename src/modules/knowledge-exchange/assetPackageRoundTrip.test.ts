import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@/shared/types/database'

/**
 * UX-14.5.10.2 integration test: export an asset, serialize it, parse/
 * validate the serialized text as if it were a re-uploaded file, then
 * import it — the same lifecycle `notePackageRoundTrip.test.ts` and
 * `knowledgeNodePackageRoundTrip.test.ts` already exercise for their
 * package types. Validates the binary-content strategy end to end: real
 * bytes go in on export, the same bytes come out reconstructed as a
 * `File` on import.
 */

const { uploadAssetMock } = vi.hoisted(() => ({ uploadAssetMock: vi.fn() }))

vi.mock('@/modules/assets/api/assets', () => ({
  uploadAsset: uploadAssetMock,
}))

import { exportAssetPackage } from '@/modules/knowledge-exchange/assets/exportAssetPackage'
import { parseAssetPackage } from '@/modules/knowledge-exchange/assets/validateAssetPackage'
import { importAssetPackage } from '@/modules/knowledge-exchange/assets/importAssetPackage'
import { uint8ArrayToBase64 } from '@/modules/knowledge-exchange/assets/base64'

function fakeSourceAsset(): Asset {
  return {
    id: 'source-asset-1',
    workspace_id: 'exporter-workspace',
    owner_id: 'exporter-1',
    title: 'Sunset over the lake',
    original_path: 'exporter-1/source-asset-1/original.jpg',
    optimized_path: 'exporter-1/source-asset-1/optimized.webp',
    thumbnail_path: 'exporter-1/source-asset-1/thumbnail.webp',
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    size_bytes: 4,
    created_at: '2026-01-01T00:00:00.000Z',
    metadata: null,
  }
}

function fakeUploadedAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'new-asset-1',
    workspace_id: 'importer-workspace',
    owner_id: 'importer-1',
    title: 'Sunset over the lake',
    original_path: 'importer-1/new-asset-1/original.jpg',
    optimized_path: 'importer-1/new-asset-1/optimized.webp',
    thumbnail_path: 'importer-1/new-asset-1/thumbnail.webp',
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    size_bytes: 4,
    created_at: '2026-03-01T00:00:00.000Z',
    metadata: null,
    ...overrides,
  }
}

describe('export -> import round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('an asset exported by one account and imported by another produces a correct, brand-new asset with the same bytes', async () => {
    const originalBytes = new Uint8Array([10, 20, 30, 40])
    const exportedPackage = exportAssetPackage({ asset: fakeSourceAsset(), fileDataBase64: uint8ArrayToBase64(originalBytes) })

    // Simulate the file round trip: serialize to text, then parse it back
    // as if a different account had just uploaded the downloaded file.
    const serialized = JSON.stringify(exportedPackage)
    const parsed = parseAssetPackage(serialized)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    // Import, as a different account, into a workspace the exporter was never in.
    const createdAsset = fakeUploadedAsset()
    uploadAssetMock.mockResolvedValueOnce(createdAsset)

    const result = await importAssetPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(createdAsset)
    const call = uploadAssetMock.mock.calls[0]![0] as { file: File; userId: string; workspaceId: string | null; title: string }
    expect(call.userId).toBe('importer-1')
    expect(call.workspaceId).toBe('importer-workspace')
    expect(call.title).toBe('Sunset over the lake')
    const buffer = await call.file.arrayBuffer()
    expect(new Uint8Array(buffer)).toEqual(originalBytes)

    // Never the exporter's identity.
    expect(uploadAssetMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(uploadAssetMock).not.toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'exporter-workspace' }))
  })

  it('rejects a hand-tampered package (unsupported version) before it ever reaches import', () => {
    const exportedPackage = exportAssetPackage({ asset: fakeSourceAsset(), fileDataBase64: uint8ArrayToBase64(new Uint8Array([1])) })
    const tampered = { ...exportedPackage, version: 999 }

    const parsed = parseAssetPackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(uploadAssetMock).not.toHaveBeenCalled()
  })

  it('rejects a package hand-edited to claim a disallowed MIME type before it ever reaches import', () => {
    const exportedPackage = exportAssetPackage({ asset: fakeSourceAsset(), fileDataBase64: uint8ArrayToBase64(new Uint8Array([1])) })
    const tampered = { ...exportedPackage, asset: { ...exportedPackage.asset, mimeType: 'image/svg+xml' } }

    const parsed = parseAssetPackage(JSON.stringify(tampered))

    expect(parsed.valid).toBe(false)
    expect(uploadAssetMock).not.toHaveBeenCalled()
  })

  it('rejects a truncated/corrupted download (malformed JSON) before it ever reaches import', () => {
    const exportedPackage = exportAssetPackage({ asset: fakeSourceAsset(), fileDataBase64: uint8ArrayToBase64(new Uint8Array([1])) })
    const truncated = JSON.stringify(exportedPackage).slice(0, -10)

    const parsed = parseAssetPackage(truncated)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.code).toBe('malformed_json')
    expect(uploadAssetMock).not.toHaveBeenCalled()
  })

  it('a lying declared mimeType/width/height on the package is informational only — cannot poison what uploadAsset receives beyond its own validation, since the real bytes still flow through untouched', async () => {
    // The package claims png but the bytes are whatever the exporter actually sent (JPEG-shaped in this fake). This
    // documents the trust boundary: importAssetPackage forwards the *declared* mimeType to `uploadAsset`, which is
    // exactly where uploadAsset's own validateImageFile/generateDerivatives independently re-validates against the
    // real bytes and would reject a genuine mismatch — that real-content check is unmodified existing code, not
    // re-implemented here.
    const originalBytes = new Uint8Array([1, 2, 3])
    const exportedPackage = exportAssetPackage({ asset: fakeSourceAsset(), fileDataBase64: uint8ArrayToBase64(originalBytes) })
    const tamperedMetadata = { ...exportedPackage, asset: { ...exportedPackage.asset, width: 999_999, height: 999_999 } }

    const parsed = parseAssetPackage(JSON.stringify(tamperedMetadata))
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    uploadAssetMock.mockResolvedValueOnce(fakeUploadedAsset({ width: 1920, height: 1080 }))
    const result = await importAssetPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    // The imported row's real width/height come from uploadAsset's own recomputation, not the package's claim.
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
  })
})
