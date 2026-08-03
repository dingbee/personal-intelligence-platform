import type { Asset } from '@/shared/types/database'
import type { ExportContent } from '@/modules/export/types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Pure — takes an already-fetched asset (already loaded on
 * `ImageReaderPage`), no fetch here. Only title/dimensions/size/created
 * date ever reach `ExportContent` — no `id`/`owner_id`/`workspace_id`/
 * `original_path`/`optimized_path`/`thumbnail_path`. The image's own
 * bytes never appear in any of the three human-readable formats — only
 * the NOVA Package path (`exportAssetPackage`, unmodified) ever carries
 * the original file content, exactly as before this phase.
 */
export function buildAssetExportContent(asset: Asset): ExportContent {
  return {
    title: asset.title,
    subtitle: `${asset.mime_type} · ${asset.width}×${asset.height} · ${formatBytes(asset.size_bytes)}`,
    sections: [{ body: [`Created ${new Date(asset.created_at).toLocaleDateString()}`] }],
  }
}
