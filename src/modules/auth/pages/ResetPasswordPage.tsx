import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { AuthCard } from '@/modules/auth/components/AuthCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'
import { appConfig } from '@/app/appConfig'

/**
 * Post-10/10 password-recovery hotfix. Supabase's client parses the
 * recovery link's token out of the URL on load (default `detectSessionInUrl`
 * behavior) and establishes a session before this component's first
 * meaningful render — `loading` covers that window. A missing session once
 * loading resolves means the link was invalid, expired, or already used;
 * that's shown as a recoverable error rather than a broken/empty form,
 * since calling `updateUser` with no session would just fail anyway.
 */
export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [updated, setUpdated] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setUpdated(true)
  }

  if (loading) {
    return (
      <div className="flex h-screen h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (updated) {
    return (
      <AuthCard title="Password updated">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Your password has been changed. Log in with your new password to continue.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Back to login
        </Link>
      </AuthCard>
    )
  }

  if (!session) {
    return (
      <AuthCard title="This link is no longer valid">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Your password reset link is invalid, expired, or has already been used.
        </p>
        <Link to="/forgot-password" className="mt-6 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Request a new reset link
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Set a new password" subtitle={`Choose a new password for your ${appConfig.productName} account`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Update password
        </Button>
      </form>
      <Link to="/login" className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline">
        Back to login
      </Link>
    </AuthCard>
  )
}
