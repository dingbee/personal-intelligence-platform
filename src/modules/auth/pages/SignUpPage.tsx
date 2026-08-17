import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { AuthCard } from '@/modules/auth/components/AuthCard'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { appConfig } from '@/app/appConfig'

/**
 * V1 Launch Hardening, Workstream 1 — a visitor denied by the
 * is_beta_invited gate previously hit a dead end: an honest error message
 * promising "Contact us for an invitation" with no actual contact
 * mechanism anywhere in the product. This builds the one real, working
 * destination for that promise, addressed to the already-documented,
 * live operator inbox (see appConfig.accessRequestEmail) rather than
 * inventing a new, unverified channel or a form with nowhere to send.
 */
function buildAccessRequestMailto(email: string): string {
  const subject = `${appConfig.productName} early access request`
  const body = email ? `I'd like to request early access to ${appConfig.productName}.\n\nMy email: ${email}` : `I'd like to request early access to ${appConfig.productName}.`
  return `mailto:${appConfig.accessRequestEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * UX-14.5.8.3 — the invitation email's "Accept invitation" link for an
 * unknown-email invitee (`workspace_invitations`) points here with
 * `?email=` prefilled, since `handle_new_user`'s reconciliation
 * (UX-14.5.8 Phase 1) matches on the exact email signed up with — a typo
 * here would create an account the invitation can never resolve against.
 * The field stays editable; this is a convenience prefill, not a lock.
 */
export function SignUpPage() {
  const { signUpWithPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notInvited, setNotInvited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotInvited(false)
    const result = await signUpWithPassword(email, password)
    if (result.error) {
      setError(result.error)
      setNotInvited(Boolean(result.notInvited))
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <AuthCard title="Check your inbox">
        <p className="text-sm text-[var(--color-ink-muted)]">
          We sent a confirmation link to <strong>{email}</strong>. Follow it to activate your
          account.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-[var(--color-accent)] hover:underline">
          Back to login
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Create your account" subtitle="ARRIYIA is currently invite-only. If your email hasn't been invited yet, you can request access below.">
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {notInvited && (
          <a
            href={buildAccessRequestMailto(email)}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Request access →
          </a>
        )}
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Sign up
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--color-accent)] hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
