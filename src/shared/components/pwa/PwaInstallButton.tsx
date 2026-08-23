import { usePwaInstall } from '@/shared/hooks/usePwaInstall'

export function PwaInstallButton() {
  const { canInstall, install } = usePwaInstall()

  if (!canInstall) return null

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Install ARRIYIA app"
      title="Install ARRIYIA app"
      className="flex h-8 items-center gap-1.5 rounded-pill bg-[var(--surface-inset)] px-3 text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--surface-base)]"
    >
      <span aria-hidden>↥</span>
      <span>Install app</span>
    </button>
  )
}
