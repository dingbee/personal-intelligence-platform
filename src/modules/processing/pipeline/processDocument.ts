import { getDocument, updateDocumentStatus } from '@/modules/library/api/documents'
import { createProcessingJob, updateProcessingJob } from '@/modules/processing/api/jobs'
import { saveExtractionMetadata } from '@/modules/processing/api/extractionMetadata'
import { saveStructuredDatasets } from '@/modules/data-intelligence/api/structuredDatasets'
import { replaceDocumentChunks } from '@/modules/processing/api/chunks'
import { getDocumentProcessor } from '@/modules/processing/extractors/registry'
import { getChunker } from '@/modules/processing/chunking/registry'
import { downloadDocumentFile } from '@/modules/processing/pipeline/downloadFile'
import { getErrorMessage } from '@/modules/processing/pipeline/getErrorMessage'
import { reportDocumentProcessingFailure } from '@/modules/processing/api/systemHealth'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { supabaseVectorStore } from '@/modules/ai/retrieval/SupabaseVectorStore'
import type { DocumentChunk } from '@/shared/types/database'

const embeddingProvider = new OpenAIEmbeddingProvider()
const EMBEDDING_BATCH_SIZE = 100

const MAX_EMBEDDING_RETRIES = 5
const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_DELAY_MS = 30_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The ai-chat edge function always answers upstream failures with its own
 * 502, so the real OpenAI status only survives inside the JSON error body
 * text (e.g. "OpenAI embeddings error: 429 ..."). Reads `err.message`
 * rather than `err.context.json()` directly — P1-3's fix to
 * `invokeAiEmbed()` (edgeFunctionClient.ts) already extracts that same
 * body's `.error` field into `.message` before this error ever reaches
 * here, and a fetch `Response` body can only be consumed once: reading
 * `.context.json()` a second time in this function would always fail,
 * since `invokeAiEmbed` already consumed it. Checking `.message` is both
 * correct and the only safe option post-fix.
 */
export async function isRateLimitError(err: unknown): Promise<boolean> {
  return err instanceof Error && /\b429\b/.test(err.message)
}

/**
 * Embeds and stores one batch, retrying in place (same batch, same chunk
 * ids) with exponential backoff when the failure is an OpenAI rate limit.
 * Non-rate-limit errors, or a rate limit that outlives the retry budget,
 * propagate to the caller so the job is marked failed — but every batch
 * embedded before this one has already been upserted and stays intact,
 * and `upsert`'s `onConflict: 'chunk_id'` means retrying this same batch
 * can't create duplicate embedding rows either.
 */
export async function embedBatchWithRetry(
  batch: DocumentChunk[],
  context: { userId: string; workspaceId: string | null },
): Promise<void> {
  let attempt = 0
  for (;;) {
    try {
      const embeddings = await embeddingProvider.embed(
        batch.map((chunk) => chunk.content),
        { userId: context.userId, workspaceId: context.workspaceId, feature: 'processing' },
      )
      await supabaseVectorStore.upsert(
        batch.map((chunk, j) => ({
          chunkId: chunk.id,
          embedding: embeddings[j]!,
          model: embeddingProvider.modelName,
        })),
      )
      return
    } catch (err) {
      attempt += 1
      if (!(await isRateLimitError(err))) throw err
      if (attempt > MAX_EMBEDDING_RETRIES) {
        throw new Error(`Embedding batch still rate-limited after ${MAX_EMBEDDING_RETRIES} retries`, {
          cause: err,
        })
      }
      await sleep(Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS))
    }
  }
}

/**
 * Runs the full pipeline for one document: extract → normalize → chunk →
 * store chunks → embed → index metadata. Runs client-side and fire-and-forget
 * from the UI; failures are recorded on the processing job and the
 * document's status rather than thrown, since nothing awaits this directly
 * after upload. Embedding requires OPENAI_API_KEY configured on the ai-chat
 * edge function — without it this stage fails cleanly (job shows the error,
 * "Reprocess" retries once it's configured), it doesn't silently no-op.
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
    if (extraction.structuredData && extraction.structuredData.length > 0) {
      await saveStructuredDatasets({
        documentId,
        userId,
        workspaceId: document.workspace_id,
        structuredData: extraction.structuredData,
      })
    }

    await updateProcessingJob(job.id, { status: 'chunking' })
    const strategy = extraction.chapters && extraction.chapters.length > 0 ? 'chapter-aware' : 'paragraph'
    const chunker = getChunker(strategy)
    const chunks = chunker.chunk({ text: extraction.text, chapters: extraction.chapters })
    const savedChunks = await replaceDocumentChunks({
      documentId,
      userId,
      workspaceId: document.workspace_id,
      chunks,
    })

    await updateProcessingJob(job.id, { status: 'embedding' })
    for (let i = 0; i < savedChunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = savedChunks.slice(i, i + EMBEDDING_BATCH_SIZE)
      await embedBatchWithRetry(batch, { userId, workspaceId: document.workspace_id })
    }

    await updateProcessingJob(job.id, { status: 'completed', completed_at: new Date().toISOString() })
    await updateDocumentStatus(documentId, 'ready')
  } catch (err) {
    // Processing failure observability fix (docs/excel-processing-failure-
    // diagnostic.md) — the diagnostic confirmed the previous `err
    // instanceof Error ? err.message : 'Processing failed'` check was
    // collapsing real diagnostic information (a PostgREST error's
    // code/details/hint, an Error-like object that failed `instanceof`,
    // a thrown string) into a useless generic string. getErrorMessage
    // extracts whatever real information the thrown value actually
    // carries, redacting anything credential-shaped, instead of assuming
    // its shape.
    const message = getErrorMessage(err)
    console.error(`Document processing failed for ${documentId}:`, err)
    await updateProcessingJob(job.id, {
      status: 'failed',
      error_message: message,
      completed_at: new Date().toISOString(),
    }).catch(() => undefined)
    await updateDocumentStatus(documentId, 'error').catch(() => undefined)
    // #21 Phase 5 — mirrors the same failure into the unified System
    // Health centre via the narrow report_document_processing_failure RPC
    // (0081_system_health_events.sql), which re-verifies server-side that
    // this document actually belongs to the caller before writing
    // anything. Best-effort: this pipeline is already fire-and-forget from
    // the UI's point of view (see this function's own module-level
    // comment), so a reporting failure here must never surface as a new
    // error to the user beyond what's already recorded above.
    await reportDocumentProcessingFailure(documentId, message).catch((reportErr) =>
      console.error(`Document processing failed for ${documentId}: also failed to report system_health_event:`, reportErr),
    )
  }
}
