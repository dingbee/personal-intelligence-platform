import { useAuth } from '@/modules/auth/useAuth'
import { Button } from '@/shared/components/ui/Button'

/** `onOpenNav` is only relevant below md — the button that calls it is hidden at md and above, where the persistent Sidebar makes it unnecessary. */
export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, signOut } = useAuth()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 md:justify-end md:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="rounded-lg px-2 py-1 text-lg leading-none text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] md:hidden"
      >
        <span aria-hidden>☰</span>
      </button>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--color-ink-muted)]">{user?.email}</span>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
