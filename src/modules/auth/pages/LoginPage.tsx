import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, type Location } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { AuthCard } from '@/modules/auth/components/AuthCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

export function LoginPage() {
  const { session, signInWithPassword } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your knowledge base">
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Log in
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-[var(--color-accent)] hover:underline">
          Forgot password?
        </Link>
        <Link to="/signup" className="text-[var(--color-accent)] hover:underline">
          Create account
        </Link>
      </div>
    </AuthCard>
  )
}
