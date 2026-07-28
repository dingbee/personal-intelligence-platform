import { useQuery } from '@tanstack/react-query'
import { getExtractionMetadata } from '@/modules/processing/api/extractionMetadata'
import { useProcessingJob } from '@/modules/processing/hooks/useProcessingJob'
import { TERMINAL_STATUSES } from '@/modules/processing/api/jobs'

export function useExtractionMetadata(documentId: string) {
  const { data: job } = useProcessingJob(documentId)

  return useQuery({
    queryKey: ['extraction-metadata', documentId],
    queryFn: () => getExtractionMetadata(documentId),
    refetchInterval: job && !TERMINAL_STATUSES.includes(job.status) ? 2000 : false,
  })
}
