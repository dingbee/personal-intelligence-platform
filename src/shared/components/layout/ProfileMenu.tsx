import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'

/** Replaces the raw email + Sign out button (Phase UX-3) — no exposed email in the header. */
export function ProfileMenu() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  return (
    <DropdownMenu
      trigger={
        <span
          aria-label="Account menu"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-sm text-[var(--color-accent)]"
        >
          👤
        </span>
      }
    >
      <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
      <DropdownMenuItem danger onClick={() => void signOut()}>
        Sign out
      </DropdownMenuItem>
    </DropdownMenu>
  )
}
