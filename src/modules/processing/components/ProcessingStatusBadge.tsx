import type { DocumentStatus } from '@/shared/types/database'
import { useProcessingJob } from '@/modules/processing/hooks/useProcessingJob'
import { Spinner } from '@/shared/components/ui/Spinner'

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued',
  extracting: 'Extracting',
  chunking: 'Chunking',
  embedding: 'Embedding',
  completed: 'Ready',
  failed: 'Error',
}

const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Ready',
  error: 'Error',
}

export function ProcessingStatusBadge({
  documentId,
  documentStatus,
}: {
  documentId: string
  documentStatus: DocumentStatus
}) {
  const { data: job } = useProcessingJob(documentId)

  if (!job) {
    return <span className="text-xs text-[var(--color-ink-muted)]">{DOCUMENT_STATUS_LABEL[documentStatus]}</span>
  }

  const inProgress = job.status !== 'completed' && job.status !== 'failed'

  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs">
      <span
        title={job.status === 'failed' ? (job.error_message ?? undefined) : undefined}
        className={`inline-flex shrink-0 items-center gap-1 ${
          job.status === 'failed'
            ? 'text-[var(--color-danger)]'
            : job.status === 'completed'
              ? 'text-[var(--color-success)]'
              : 'text-[var(--color-ink-muted)]'
        }`}
      >
        {inProgress && <Spinner size="sm" />}
        {STAGE_LABEL[job.status]}
      </span>
      {/* Bug investigation (post-Data Intelligence Foundation) — the
          technical error was already captured in job.error_message but
          only surfaced as a hover tooltip, invisible on touch devices and
          easy to miss in a grid of cards. A short inline excerpt (still
          truncated, full text remains in the tooltip and on Document
          Detail) means "processing failed" is never the only thing a user
          sees without knowing to hover. */}
      {job.status === 'failed' && job.error_message && (
        <span className="min-w-0 truncate text-[var(--color-danger)]" title={job.error_message}>
          — {job.error_message}
        </span>
      )}
    </span>
  )
}
