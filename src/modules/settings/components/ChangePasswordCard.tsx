import { useState, type FormEvent } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function ChangePasswordCard() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSuccess(false)
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setSubmitting(true)
    setError(null)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    setPassword('')
    setConfirmPassword('')
    setSuccess(true)
  }

  return (
    <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[var(--color-ink)]">Change password</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
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
        {success && <p className="text-sm text-[var(--color-success-strong)]">Password updated.</p>}
        <Button type="submit" loading={submitting} className="mt-1">
          Update password
        </Button>
      </form>
    </div>
  )
}
