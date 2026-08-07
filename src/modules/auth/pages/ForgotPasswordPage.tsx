import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { AuthCard } from '@/modules/auth/components/AuthCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await sendPasswordReset(email)
    if (error) setError(error)
    else setSent(true)
    setSubmitting(false)
  }

  if (sent) {
    return (
      <AuthCard title="Check your inbox">
        <p className="text-sm text-[var(--color-ink-muted)]">
          If an account exists for <strong>{email}</strong>, we sent a link to reset your
          password.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Back to login
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a reset link">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Send reset link
        </Button>
      </form>
      <Link to="/login" className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline">
        Back to login
      </Link>
    </AuthCard>
  )
}
