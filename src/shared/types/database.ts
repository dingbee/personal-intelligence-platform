/**
 * Hand-written subset of the Supabase schema used through Milestone 2.
 * Regenerate with the Supabase CLI (`supabase gen types typescript`) once
 * the schema grows past what's practical to hand-maintain.
 */
// `type` rather than `interface` on purpose: interfaces don't get an
// implicit index signature, so they fail the `Record<string, unknown>`
// structural check supabase-js's generics rely on to resolve table types.
export type Profile = {
  id: string
  email: string
  display_name: string | null
  created_at: string
  updated_at: string
}

export type DocumentFileType = 'pdf' | 'epub' | 'docx' | 'txt' | 'markdown'
export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error'

export type Collection = {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  user_id: string
  collection_id: string | null
  title: string
  file_name: string
  file_path: string
  file_type: DocumentFileType
  file_size: number
  status: DocumentStatus
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type DocumentTag = {
  document_id: string
  tag_id: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
        Relationships: []
      }
      collections: {
        Row: Collection
        Insert: Partial<Collection> & { user_id: string; name: string }
        Update: Partial<Collection>
        Relationships: []
      }
      documents: {
        Row: DocumentRow
        Insert: Partial<DocumentRow> & {
          user_id: string
          title: string
          file_name: string
          file_path: string
          file_type: DocumentFileType
          file_size: number
        }
        Update: Partial<DocumentRow>
        Relationships: []
      }
      tags: {
        Row: Tag
        Insert: Partial<Tag> & { user_id: string; name: string }
        Update: Partial<Tag>
        Relationships: []
      }
      document_tags: {
        Row: DocumentTag
        Insert: DocumentTag
        Update: Partial<DocumentTag>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      document_file_type: DocumentFileType
      document_status: DocumentStatus
    }
  }
}
