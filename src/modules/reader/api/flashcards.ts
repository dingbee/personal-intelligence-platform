import { supabase } from '@/shared/lib/supabase'
import type { Flashcard } from '@/shared/types/database'

export async function listFlashcards(documentId: string, chapterIndex?: number): Promise<Flashcard[]> {
  let query = supabase
    .from('flashcards')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (chapterIndex !== undefined) query = query.eq('chapter_index', chapterIndex)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createFlashcards(params: {
  documentId: string
  userId: string
  chapterIndex: number | null
  cards: { front: string; back: string }[]
}): Promise<Flashcard[]> {
  if (params.cards.length === 0) return []
  const { data, error } = await supabase
    .from('flashcards')
    .insert(
      params.cards.map((card) => ({
        document_id: params.documentId,
        user_id: params.userId,
        chapter_index: params.chapterIndex,
        front: card.front,
        back: card.back,
      })),
    )
    .select()
  if (error) throw error
  return data
}
