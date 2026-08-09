import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { usePlatformAdmin } from '@/modules/admin/hooks/usePlatformAdmin'
import { deleteMyAccount } from '@/modules/settings/api/accountDeletion'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { Button } from '@/shared/components/ui/Button'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

/**
 * PIP Sprint 10/10 (Final Platform Validation) — closes the P1 identified
 * in Sprint 9.5's release backlog: no self-service account deletion
 * existed. Deletes the Auth account (delete-account edge function,
 * server-side only — the service-role key it needs can't live in this
 * bundle), which cascades every owned row via the existing `on delete
 * cascade` foreign keys already in place across the whole schema, plus
 * the two things cascade can't reach: Storage objects and the auth.users
 * row itself. See docs/account-deletion-data-map.md for the full record
 * of what's deleted and what's preserved.
 *
 * Admin accounts see a disabled state with an explanation rather than a
 * button that would just fail server-side — `usePlatformAdmin` is
 * UI-only (the edge function re-checks `is_platform_admin()` itself
 * regardless of what this hook returns), so this is purely to avoid a
 * confusing failed attempt, never the actual enforcement.
 */
export function DeleteAccountCard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { data: isAdmin, isLoading: adminLoading } = usePlatformAdmin()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setConfirmOpen(false)
    setDeleting(true)
    setError(null)

    const { error: deleteError } = await deleteMyAccount()
    if (deleteError) {
      setError(deleteError)
      setDeleting(false)
      return
    }

    // The account no longer exists server-side; clear the local session
    // so the UI doesn't sit in a stale "still logged in" state waiting
    // for the next auth-dependent request to discover it's gone.
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <SurfaceCard className="max-w-md border-[var(--color-danger)]/30">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Delete account</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Permanently deletes your account and everything in it — documents, notes, images, spreadsheets, conversations,
        personal memory, and knowledge graph connections. Content you shared into a workspace with others is removed
        from your account; other members keep their own content. This cannot be undone.
      </p>

      {isAdmin && !adminLoading && (
        <p className="mt-3 text-xs text-[var(--color-danger)]">
          Platform admin accounts can't be deleted through self-service account deletion. Contact another
          administrator to revoke admin status first.
        </p>
      )}

      {error && <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>}

      <Button
        variant="secondary"
        className="mt-3 border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
        disabled={Boolean(isAdmin) || adminLoading || deleting}
        loading={deleting}
        onClick={() => setConfirmOpen(true)}
      >
        Delete my account
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account?"
        description="This permanently deletes your account and all of your content. This cannot be undone."
        confirmLabel="Delete my account"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </SurfaceCard>
  )
}
