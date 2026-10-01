import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { AuthCard } from '@/modules/auth/components/AuthCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function LoginPage() {
  const { session, signInWithPassword, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  if (session) {
    const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/library'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signInWithPassword(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  async function handleGoogleSignIn() {
    setGoogleSubmitting(true)
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error)
      setGoogleSubmitting(false)
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your ARRIYIA workspace">
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="secondary"
          loading={googleSubmitting}
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="w-full"
        >
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          <span>or</span>
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {error}
            </p>
          )}
          <Button type="submit" loading={submitting} disabled={googleSubmitting} className="mt-2 w-full">
            Sign in
          </Button>
        </form>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <Link to="/forgot-password" className="text-[var(--color-accent)] hover:underline">
          Forgot password?
        </Link>
        <Link to="/signup" className="font-medium text-[var(--color-accent)] hover:underline">
          Create account
        </Link>
      </div>
    </AuthCard>
  )
}
