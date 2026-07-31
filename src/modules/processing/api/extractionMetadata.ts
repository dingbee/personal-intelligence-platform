import { supabase } from '@/shared/lib/supabase'
import type { ExtractionMetadata } from '@/shared/types/database'
import type { ExtractionResult } from '@/modules/processing/extractors/types'
import { toChapterSummaries } from '@/modules/processing/extractors/types'
import type { SheetAnalysis } from '@/modules/processing/spreadsheet/types'

export async function saveExtractionMetadata(params: {
  documentId: string
  userId: string
  extraction: ExtractionResult
}): Promise<void> {
  const { documentId, userId, extraction } = params
  const { error } = await supabase.from('extraction_metadata').upsert(
    {
      document_id: documentId,
      user_id: userId,
      title: extraction.title,
      author: extraction.author,
      language: extraction.language,
      page_count: extraction.pageCount,
      chapter_count: extraction.chapters?.length ?? null,
      word_count: extraction.wordCount,
      char_count: extraction.charCount,
      metadata: {
        chapters: toChapterSummaries(extraction.chapters),
        ...(extraction.spreadsheetAnalysis ? { spreadsheet: extraction.spreadsheetAnalysis } : {}),
      },
    },
    { onConflict: 'document_id' },
  )
  if (error) throw error
}

export async function getExtractionMetadata(documentId: string): Promise<ExtractionMetadata | null> {
  const { data, error } = await supabase
    .from('extraction_metadata')
    .select('*')
    .eq('document_id', documentId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** UX-13.10 — the one place `metadata.spreadsheet` is cast back to its real shape, so no other caller reaches into the jsonb blob directly. */
export function getSpreadsheetAnalysis(metadata: ExtractionMetadata | null | undefined): SheetAnalysis[] | null {
  const spreadsheet = metadata?.metadata.spreadsheet
  return spreadsheet && spreadsheet.length > 0 ? (spreadsheet as SheetAnalysis[]) : null
}
