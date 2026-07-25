import { getDocument, updateDocumentStatus } from '@/modules/library/api/documents'
import { createProcessingJob, updateProcessingJob } from '@/modules/processing/api/jobs'
import { saveExtractionMetadata } from '@/modules/processing/api/extractionMetadata'
import { replaceDocumentChunks } from '@/modules/processing/api/chunks'
import { getDocumentProcessor } from '@/modules/processing/extractors/registry'
import { getChunker } from '@/modules/processing/chunking/registry'
import { downloadDocumentFile } from '@/modules/processing/pipeline/downloadFile'
import { PlaceholderEmbeddingProvider } from '@/modules/ai/embeddings/EmbeddingProvider'
import { supabaseVectorStore } from '@/modules/ai/retrieval/SupabaseVectorStore'

const embeddingProvider = new PlaceholderEmbeddingProvider()

/**
 * Runs the full pipeline for one document: extract → normalize → chunk →
 * store chunks → embed (placeholder) → index metadata. Runs client-side and
 * fire-and-forget from the UI; failures are recorded on the processing job
 * and the document's status rather than thrown, since nothing awaits this
 * directly after upload.
 */
export async function processDocument(documentId: string, userId: string): Promise<void> {
  const job = await createProcessingJob({ documentId, userId })

  try {
    await updateDocumentStatus(documentId, 'processing')

    await updateProcessingJob(job.id, { status: 'extracting' })
    const document = await getDocument(documentId)
    const file = await downloadDocumentFile(document.file_path)
    const processor = await getDocumentProcessor(document.file_type)
    const extraction = await processor.extract(file)
    await saveExtractionMetadata({ documentId, userId, extraction })

    await updateProcessingJob(job.id, { status: 'chunking' })
    const strategy = extraction.chapters && extraction.chapters.length > 0 ? 'chapter-aware' : 'paragraph'
    const chunker = getChunker(strategy)
    const chunks = chunker.chunk({ text: extraction.text, chapters: extraction.chapters })
    const savedChunks = await replaceDocumentChunks({ documentId, userId, chunks })

    await updateProcessingJob(job.id, { status: 'embedding' })
    if (savedChunks.length > 0) {
      const embeddings = await embeddingProvider.embed(savedChunks.map((chunk) => chunk.content))
      await supabaseVectorStore.upsert(
        savedChunks.map((chunk, i) => ({
          chunkId: chunk.id,
          embedding: embeddings[i]!,
          model: embeddingProvider.modelName,
        })),
      )
    }

    await updateProcessingJob(job.id, { status: 'completed', completed_at: new Date().toISOString() })
    await updateDocumentStatus(documentId, 'ready')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    console.error(`Document processing failed for ${documentId}:`, err)
    await updateProcessingJob(job.id, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined)
    await updateDocumentStatus(documentId, 'error').catch(() => undefined)
  }
}
