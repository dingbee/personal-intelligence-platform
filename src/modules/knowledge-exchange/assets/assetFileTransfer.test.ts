import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAssetSignedUrlMock } = vi.hoisted(() => ({ getAssetSignedUrlMock: vi.fn() }))

vi.mock('@/modules/assets/api/assets', () => ({
  getAssetSignedUrl: getAssetSignedUrlMock,
}))

import { fetchAssetOriginalAsBase64 } from '@/modules/knowledge-exchange/assets/assetFileTransfer'
import { base64ToUint8Array } from '@/modules/knowledge-exchange/assets/base64'

describe('fetchAssetOriginalAsBase64', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('signs the original path, downloads it, and returns matching base64 bytes', async () => {
    getAssetSignedUrlMock.mockResolvedValueOnce('https://signed.example/original.png')
    const originalBytes = new Uint8Array([1, 2, 3, 4, 5])
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(originalBytes.buffer),
    } as unknown as Response)

    const result = await fetchAssetOriginalAsBase64({ original_path: 'user-1/asset-1/original.png' })

    expect(getAssetSignedUrlMock).toHaveBeenCalledWith('user-1/asset-1/original.png')
    expect(fetch).toHaveBeenCalledWith('https://signed.example/original.png')
    expect(base64ToUint8Array(result)).toEqual(originalBytes)
  })

  it('throws a clear error when the signed download fails', async () => {
    getAssetSignedUrlMock.mockResolvedValueOnce('https://signed.example/original.png')
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as unknown as Response)

    await expect(fetchAssetOriginalAsBase64({ original_path: 'user-1/asset-1/original.png' })).rejects.toThrow(/403/)
  })
})
