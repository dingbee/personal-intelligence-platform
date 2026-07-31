import { useState } from 'react'
import type { Asset } from '@/shared/types/database'
import { ImageCard } from '@/modules/assets/components/ImageCard'
import { ImageLightbox } from '@/modules/assets/components/ImageLightbox'
import { EmptyState } from '@/shared/components/ui/EmptyState'

export function ImageGrid({ assets }: { assets: Asset[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (assets.length === 0) {
    return <EmptyState title="No images here" description="Upload an image above, or try a different search." />
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset, index) => (
          <ImageCard key={asset.id} asset={asset} onOpenLightbox={() => setLightboxIndex(index)} />
        ))}
      </div>
      {lightboxIndex !== null && (
        <ImageLightbox assets={assets} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  )
}
