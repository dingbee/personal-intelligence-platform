import { describe, expect, it } from 'vitest'
import { buildAssetExportContent } from '@/modules/export/content/assetExportContent'
import type { Asset } from '@/shared/types/database'

function fakeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    workspace_id: 'workspace-1',
    owner_id: 'user-1',
    title: 'Riverbank Photo',
    original_path: 'user-1/asset-1-original.jpg',
    optimized_path: 'user-1/asset-1-optimized.jpg',
    thumbnail_path: 'user-1/asset-1-thumb.jpg',
    mime_type: 'image/jpeg',
    width: 1920,
    height: 1080,
    size_bytes: 2_400_000,
    created_at: '2026-01-01T00:00:00.000Z',
    metadata: null,
    ...overrides,
  }
}

describe('buildAssetExportContent', () => {
  it('carries the title and a mime/dimensions/size subtitle', () => {
    const content = buildAssetExportContent(fakeAsset())
    expect(content.title).toBe('Riverbank Photo')
    expect(content.subtitle).toBe('image/jpeg · 1920×1080 · 2.3 MB')
  })

  it('renders a single created-date section', () => {
    const content = buildAssetExportContent(fakeAsset())
    expect(content.sections).toHaveLength(1)
    expect(content.sections[0]!.body[0]).toContain('Created')
  })

  it('never carries id/owner_id/workspace_id/storage paths', () => {
    const content = buildAssetExportContent(fakeAsset())
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('asset-1')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('workspace-1')
    expect(serialized).not.toContain('original.jpg')
  })
})
