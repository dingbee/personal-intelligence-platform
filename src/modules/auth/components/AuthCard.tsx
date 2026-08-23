import type { ReactNode } from 'react'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-h-dvh items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <ArriyiaLogo className="h-10 w-10 rounded-xl" />
          <span className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">ARRIYIA</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
