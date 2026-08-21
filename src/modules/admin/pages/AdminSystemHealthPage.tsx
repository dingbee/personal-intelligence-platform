import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminAcknowledgeSystemHealthEvent,
  useAdminIgnoreSystemHealthEvent,
  useAdminReopenSystemHealthEvent,
  useAdminResolveSystemHealthEvent,
  useAdminSystemHealthEvents,
  useAdminSystemHealthSummary,
  useAdminUsers,
} from '@/modules/admin/hooks/useAdminData'
import type { SystemHealthEventCategory, SystemHealthEventSeverity, SystemHealthEventStatus } from '@/shared/types/database'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { Spinner } from '@/shared/components/ui/Spinner'
import { EmptyState } from '@/shared/components/ui/EmptyState'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

const CATEGORY_LABELS: Record<SystemHealthEventCategory, string> = {
  auth: 'Auth',
  ai: 'AI',
  documents: 'Documents',
  billing: 'Billing',
  collaboration: 'Collaboration',
  system: 'System',
}

const SEVERITY_CLASSES: Record<SystemHealthEventSeverity, string> = {
  critical: 'text-[var(--color-danger)] font-semibold',
  error: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning,var(--color-accent))]',
  info: 'text-[var(--color-ink-muted)]',
}

const STATUS_LABELS: Record<SystemHealthEventStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  ignored: 'Ignored',
}

/**
 * #21 Phase 5 — Unified Admin Intelligence / Error Centre. Reads through
 * admin_list_system_health_events/admin_system_health_summary; every action
 * (acknowledge/resolve/reopen/ignore) calls its own SECURITY DEFINER RPC,
 * each re-checking is_platform_admin() server-side — there is no direct
 * table write from this page (system_health_events has zero client grants
 * of any kind, by design; see 0081_system_health_events.sql).
 */
export function AdminSystemHealthPage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: summary } = useAdminSystemHealthSummary()
  const { data: users = [] } = useAdminUsers()
  const { data: events = [], isLoading } = useAdminSystemHealthEvents({
    category: categoryFilter || null,
    severity: severityFilter || null,
    status: statusFilter || null,
  })

  const acknowledge = useAdminAcknowledgeSystemHealthEvent()
  const resolve = useAdminResolveSystemHealthEvent()
  const reopen = useAdminReopenSystemHealthEvent()
  const ignore = useAdminIgnoreSystemHealthEvent()

  const emailByUserId = useMemo(() => new Map(users.map((u) => [u.id, u.email])), [users])
  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId) ?? null, [events, selectedEventId])

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setStatus(null)
    try {
      await action()
      setStatus({ type: 'success', message: successMessage })
    } catch (err) {
      setStatus({ type: 'error', message: errorMessage(err, 'Action failed. Please try again.') })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin" className="text-xs text-[var(--color-accent)] hover:underline">
          ← Founder Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">System Health</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Operational events reported by the application's own failure paths (AUTH/AI/DOCUMENTS/BILLING/COLLABORATION/SYSTEM). A failure
          visible only inside Supabase's own infrastructure logs will not appear here — this surfaces application-level events only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open critical" value={summary?.open_critical ?? '–'} />
        <StatCard label="Open errors" value={summary?.open_error ?? '–'} />
        <StatCard label="Warnings" value={summary?.open_warning ?? '–'} />
        <StatCard label="Events today" value={summary?.events_today ?? '–'} />
        <StatCard label="Unresolved" value={summary?.unresolved ?? '–'} />
      </div>

      {status && (
        <p
          role={status.type === 'error' ? 'alert' : undefined}
          className={`text-xs ${status.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}
        >
          {status.message}
        </p>
      )}

      <SurfaceCard>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            Category
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="">All</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            Severity
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="">All</option>
              {(['critical', 'error', 'warning', 'info'] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
            >
              <option value="">All</option>
              {(Object.keys(STATUS_LABELS) as SystemHealthEventStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <Spinner size="sm" />
        ) : events.length === 0 ? (
          <EmptyState title="No matching events" description="Nothing in system_health_events matches the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[var(--color-ink-muted)]">
                  <th className="pb-2 pr-4 font-medium">Severity</th>
                  <th className="pb-2 pr-4 font-medium">Last seen</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Operation</th>
                  <th className="pb-2 pr-4 font-medium">Affected user</th>
                  <th className="pb-2 pr-4 font-medium">Message</th>
                  <th className="pb-2 pr-4 font-medium">×</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => {
                      setSelectedEventId(event.id)
                      setResolutionNote('')
                      setStatus(null)
                    }}
                    className={`cursor-pointer border-t border-[var(--color-border)] align-top hover:bg-[var(--surface-inset)] ${
                      selectedEventId === event.id ? 'bg-[var(--surface-inset)]' : ''
                    }`}
                  >
                    <td className={`py-2 pr-4 ${SEVERITY_CLASSES[event.severity]}`}>{event.severity}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{formatDate(event.last_occurred_at)}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{CATEGORY_LABELS[event.category]}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{event.operation}</td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{event.user_id ? (emailByUserId.get(event.user_id) ?? event.user_id) : '—'}</td>
                    <td className="max-w-xs truncate py-2 pr-4 text-[var(--color-ink)]" title={event.message}>
                      {event.message}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-muted)]">{event.occurrence_count}</td>
                    <td className="py-2 text-[var(--color-ink-muted)]">{STATUS_LABELS[event.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {selectedEvent && (
        <SurfaceCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Event detail</h2>
              <p className={`mt-1 text-xs ${SEVERITY_CLASSES[selectedEvent.severity]}`}>
                {selectedEvent.severity.toUpperCase()} · {CATEGORY_LABELS[selectedEvent.category]} · {selectedEvent.operation}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedEventId(null)} className="text-xs text-[var(--color-ink-muted)] hover:underline">
              Close
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-ink-muted)]">First/last occurred</dt>
              <dd className="text-[var(--color-ink)]">
                {formatDate(selectedEvent.created_at)} → {formatDate(selectedEvent.last_occurred_at)} ({selectedEvent.occurrence_count}×)
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Status</dt>
              <dd className="text-[var(--color-ink)]">{STATUS_LABELS[selectedEvent.status]}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Affected user</dt>
              <dd className="text-[var(--color-ink)]">
                {selectedEvent.user_id ? (emailByUserId.get(selectedEvent.user_id) ?? selectedEvent.user_id) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Provider</dt>
              <dd className="text-[var(--color-ink)]">{selectedEvent.provider ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Error code</dt>
              <dd className="text-[var(--color-ink)]">{selectedEvent.error_code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Related entity</dt>
              <dd className="text-[var(--color-ink)]">
                {selectedEvent.related_entity_type ? `${selectedEvent.related_entity_type}: ${selectedEvent.related_entity_id}` : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-ink-muted)]">Message</dt>
              <dd className="text-[var(--color-ink)]">{selectedEvent.message}</dd>
            </div>
            {selectedEvent.diagnosis && (
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-ink-muted)]">Diagnosis / resolution notes</dt>
                <dd className="text-[var(--color-ink)]">{selectedEvent.diagnosis}</dd>
              </div>
            )}
            {Object.keys(selectedEvent.metadata ?? {}).length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-[var(--color-ink-muted)]">Metadata</dt>
                <dd className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--color-ink-muted)]">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </dd>
              </div>
            )}
            {selectedEvent.acknowledged_at && (
              <div>
                <dt className="text-[var(--color-ink-muted)]">Acknowledged</dt>
                <dd className="text-[var(--color-ink)]">{formatDate(selectedEvent.acknowledged_at)}</dd>
              </div>
            )}
            {selectedEvent.resolved_at && (
              <div>
                <dt className="text-[var(--color-ink-muted)]">Resolved</dt>
                <dd className="text-[var(--color-ink)]">{formatDate(selectedEvent.resolved_at)}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-4">
            {selectedEvent.status === 'open' && (
              <button
                type="button"
                disabled={acknowledge.isPending}
                onClick={() => runAction(() => acknowledge.mutateAsync(selectedEvent.id), 'Event acknowledged.')}
                className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink)] hover:bg-[var(--surface-inset)] disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            {(selectedEvent.status === 'open' || selectedEvent.status === 'acknowledged') && (
              <>
                <input
                  type="text"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Resolution note (optional)"
                  aria-label="Resolution note"
                  className="w-56 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-ink)]"
                />
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() =>
                    runAction(
                      () => resolve.mutateAsync({ eventId: selectedEvent.id, resolutionNote: resolutionNote || null }),
                      'Event resolved.',
                    )
                  }
                  className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--surface-inset)] disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={ignore.isPending}
                  onClick={() => runAction(() => ignore.mutateAsync(selectedEvent.id), 'Event ignored.')}
                  className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] hover:bg-[var(--surface-inset)] disabled:opacity-50"
                >
                  Ignore
                </button>
              </>
            )}
            {(selectedEvent.status === 'resolved' || selectedEvent.status === 'ignored') && (
              <button
                type="button"
                disabled={reopen.isPending}
                onClick={() => runAction(() => reopen.mutateAsync(selectedEvent.id), 'Event reopened.')}
                className="rounded-control border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink)] hover:bg-[var(--surface-inset)] disabled:opacity-50"
              >
                Reopen
              </button>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}
