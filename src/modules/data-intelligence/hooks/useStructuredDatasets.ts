import { useQuery } from '@tanstack/react-query'
import { listStructuredDatasetsForDocument } from '@/modules/data-intelligence/api/structuredDatasets'

/** Data Intelligence Foundation — lists a document's persisted structured datasets (one per sheet), for the query panel's sheet picker. */
export function useStructuredDatasets(documentId: string) {
  return useQuery({
    queryKey: ['structured-datasets', documentId],
    queryFn: () => listStructuredDatasetsForDocument(documentId),
  })
}
