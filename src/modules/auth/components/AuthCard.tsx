import type { ReactNode } from 'react'
import { ArriyiaLogo } from '@/shared/components/branding/ArriyiaLogo'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen min-h-dvh bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="mx-auto grid min-h-screen min-h-dvh max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between px-10 py-10 lg:flex xl:px-16">
          <div className="max-w-xl pt-20">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              Personal Intelligence Platform
            </p>
            <h2 className="max-w-lg text-5xl font-semibold tracking-[-0.035em] text-[var(--color-ink)] xl:text-6xl">
              Think deeper.
              <br />
              Do more.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--color-ink-muted)]">
              Capture knowledge, connect ideas, uncover insight, and turn what you know into meaningful action.
            </p>

            <div className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-[var(--color-border)] pt-7">
              {[
                ['Knowledge', 'Keep what matters organised and accessible.'],
                ['Intelligence', 'Turn information into connected insight.'],
                ['Action', 'Move from understanding to execution.'],
              ].map(([label, description]) => (
                <div key={label}>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{label}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs tracking-[0.22em] text-[var(--color-ink-muted)]">
            KNOWLEDGE&nbsp;&nbsp;·&nbsp;&nbsp;INSIGHT&nbsp;&nbsp;·&nbsp;&nbsp;ACTION
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:p-10">
            <div className="mb-9 flex flex-col items-center text-center">
              <ArriyiaLogo className="h-16 w-16 object-contain" />
              <p className="mt-4 text-lg font-semibold tracking-[0.22em] text-[var(--color-ink)]">ARRIYIA</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--color-accent)]">
                Your intelligence amplifier
              </p>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
