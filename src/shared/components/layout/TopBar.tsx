import { useAuth } from '@/modules/auth/useAuth'
import { Button } from '@/shared/components/ui/Button'

export function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-4 border-b border-[var(--color-border)] px-6">
      <span className="text-sm text-[var(--color-ink-muted)]">{user?.email}</span>
      <Button variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </header>
  )
}
