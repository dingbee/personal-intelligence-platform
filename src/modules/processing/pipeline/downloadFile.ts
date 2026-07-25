import { supabase } from '@/shared/lib/supabase'

export async function downloadDocumentFile(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from('documents').download(filePath)
  if (error) throw error
  return data
}
