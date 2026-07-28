import { useQuery } from '@tanstack/react-query'
import { countDocumentChunks } from '@/modules/processing/api/chunks'
import { useProcessingJob } from '@/modules/processing/hooks/useProcessingJob'
import { TERMINAL_STATUSES } from '@/modules/processing/api/jobs'

export function useDocumentChunkCount(documentId: string) {
  const { data: job } = useProcessingJob(documentId)

  return useQuery({
    queryKey: ['document-chunk-count', documentId],
    queryFn: () => countDocumentChunks(documentId),
    refetchInterval: job && !TERMINAL_STATUSES.includes(job.status) ? 2000 : false,
  })
}
