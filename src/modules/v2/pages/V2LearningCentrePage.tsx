import { useMemo, useState } from 'react'
import { emitLearningSignal } from '../learning/service'
import { V2ControlPlaneStore } from '../control-plane/store'

const stages = [
  ['Feedback', 'Capture explicit user correction, acceptance, rejection and relevance signals.'],
  ['Intervention', 'Record where a human accepts, modifies, rejects or overrides a recommendation.'],
  ['Outcome', 'Associate observed results with the action/run that followed a recommendation.'],
  ['Effectiveness', 'Measure acceptance, outcome success and feedback response without pretending correlation is causation.'],
  ['Learning Signal', 'Produce a scoped signal with explicit evidence references for future intelligence.'],
] as const

export function V2LearningCentrePage() {
  const [signalCount, setSignalCount] = useState(0)
  const store = useMemo(() => new V2ControlPlaneStore(), [])

  const createDemoSignal = () => {
    try {
      store.save('organization', {
        id: 'demo-org',
        organizationId: 'demo-org',
        name: 'Demo',
        slug: 'demo',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      store.save('workspace', {
        id: 'demo-workspace',
        organizationId: 'demo-org',
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      emitLearningSignal(store, {
        id: crypto.randomUUID(),
        organizationId: 'demo-org',
        workspaceId: 'demo-workspace',
        signalType: 'demo.learning',
        sourceType: 'effectiveness',
        sourceId: 'demo-source',
        subjectType: 'recommendation',
        subjectId: 'demo-recommendation',
        value: 0.8,
        confidence: 0.8,
        evidenceIds: [],
      }, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setSignalCount((count) => count + 1)
    } catch {
      // The page is a control-plane demonstration; production persistence is intentionally deferred.
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">ARRIYIA V2</p>
        <h1 className="text-3xl font-semibold tracking-tight">Learning Centre</h1>
        <p className="max-w-3xl text-muted-foreground">
          Convert governed evidence into learning signals while preserving provenance, tenant scope and the NoVA execution boundary.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        {stages.map(([title, description], index) => (
          <article key={title} className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-xs font-semibold text-muted-foreground">0{index + 1}</div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Evidence-first</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every learning signal points back to explicit feedback, intervention, outcome or effectiveness evidence.</p>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Scoped</h2>
          <p className="mt-2 text-sm text-muted-foreground">Learning resources inherit organization/workspace boundaries and fail closed on cross-workspace access.</p>
        </article>
        <article className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">NoVA-safe</h2>
          <p className="mt-2 text-sm text-muted-foreground">Learning evaluates what happened; it does not execute the next action or create a competing runtime.</p>
        </article>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Control-plane signal test</h2>
            <p className="mt-1 text-sm text-muted-foreground">Creates an in-memory demonstration signal only. No production persistence is performed.</p>
          </div>
          <button type="button" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted" onClick={createDemoSignal}>
            Emit test signal
          </button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Signals created in this session: {signalCount}</p>
      </section>
    </main>
  )
}
