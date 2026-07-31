import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Asset } from '@/shared/types/database'
import { useSignedAssetUrl } from '@/modules/assets/hooks/useSignedAssetUrl'
import { Spinner } from '@/shared/components/ui/Spinner'

/**
 * UX-13.9 — full-screen quick preview, opened from a card's thumbnail.
 * Built on native <dialog> with the same showModal/backdrop-click/Esc
 * mechanism EdgeDrawerDialog already proved out (Esc-to-close and focus
 * return are free from the browser; backdrop click-to-close needs the
 * dialog's own onClick plus stopPropagation on the inner content). Not
 * reusing EdgeDrawerDialog itself — its chrome is hardcoded to a left
 * edge drawer, a different visual shape from a centered full-screen
 * viewer — but the interaction pattern is deliberately identical.
 */
export function ImageLightbox({
  assets,
  index,
  onIndexChange,
  onClose,
}: {
  assets: Asset[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const asset = assets[index]!
  const { data: imageUrl, isLoading } = useSignedAssetUrl(asset.optimized_path)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
      if (event.key === 'ArrowRight' && index < assets.length - 1) onIndexChange(index + 1)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, assets.length, onIndexChange])

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      onClick={onClose}
      aria-label={asset.title}
      className="m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/80"
    >
      <div onClick={(event) => event.stopPropagation()} className="relative flex h-full w-full flex-col">
        <div className="flex items-center justify-between gap-4 p-4">
          <h2 className="min-w-0 truncate text-sm font-medium text-white" title={asset.title}>
            {asset.title}
          </h2>
          <div className="flex shrink-0 items-center gap-4">
            <Link to={`/library/assets/${asset.id}`} className="text-sm text-white/80 hover:text-white">
              Open reader →
            </Link>
            <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-white/80 hover:text-white">
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
          {isLoading ? (
            <Spinner />
          ) : imageUrl ? (
            <img src={imageUrl} alt={asset.title} className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="text-white/60">Couldn't load image</p>
          )}
        </div>

        {assets.length > 1 && (
          <div className="flex items-center justify-center gap-4 pb-6">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onIndexChange(index - 1)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white disabled:opacity-30"
            >
              ← Previous
            </button>
            <span className="text-xs text-white/60">
              {index + 1} of {assets.length}
            </span>
            <button
              type="button"
              disabled={index === assets.length - 1}
              onClick={() => onIndexChange(index + 1)}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
