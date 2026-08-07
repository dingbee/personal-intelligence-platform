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
    <span
      title={job.status === 'failed' ? (job.error_message ?? undefined) : undefined}
      className={`inline-flex items-center gap-1 text-xs ${
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
  )
}
