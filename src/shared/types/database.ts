/**
 * Hand-written subset of the Supabase schema used through Milestone 6.
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
export type ProcessingStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'completed'
  | 'failed'

export type Workspace = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export type Collection = {
  id: string
  user_id: string
  workspace_id: string | null
  parent_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export type DocumentRow = {
  id: string
  user_id: string
  workspace_id: string | null
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

export type ProcessingJob = {
  id: string
  document_id: string
  user_id: string
  status: ProcessingStatus
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ExtractionChapterSummary = { index: number; title: string }

export type ExtractionMetadata = {
  document_id: string
  user_id: string
  title: string | null
  author: string | null
  language: string | null
  page_count: number | null
  chapter_count: number | null
  word_count: number | null
  char_count: number | null
  metadata: { chapters?: ExtractionChapterSummary[] } & Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DocumentChunk = {
  id: string
  document_id: string
  user_id: string
  workspace_id: string | null
  chunk_index: number
  content: string
  char_start: number
  char_end: number
  token_count: number
  chapter_index: number | null
  chapter_title: string | null
  created_at: string
}

export type Embedding = {
  id: string
  chunk_id: string
  model: string
  embedding: number[]
  created_at: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export type Conversation = {
  id: string
  user_id: string
  workspace_id: string | null
  document_id: string | null
  title: string
  provider_id: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  user_id: string
  role: MessageRole
  content: string
  context_chunk_ids: string[]
  created_at: string
}

export type MessageEmbedding = {
  id: string
  message_id: string
  model: string
  embedding: number[]
  created_at: string
}

export type ReadingProgress = {
  document_id: string
  user_id: string
  chapter_index: number
  scroll_fraction: number
  updated_at: string
}

export type Highlight = {
  id: string
  document_id: string
  user_id: string
  chapter_index: number | null
  quote: string
  note: string | null
  created_at: string
  updated_at: string
}

export type ChapterSummary = {
  document_id: string
  user_id: string
  chapter_index: number
  content: string
  model: string
  created_at: string
  updated_at: string
}

export type Flashcard = {
  id: string
  document_id: string
  user_id: string
  chapter_index: number | null
  front: string
  back: string
  created_at: string
}

export type AiRequestStatus = 'success' | 'error'

export type AiRequest = {
  id: string
  user_id: string
  workspace_id: string | null
  feature: string
  provider: string
  model: string | null
  tokens_input: number | null
  tokens_output: number | null
  latency_ms: number
  status: AiRequestStatus
  error_message: string | null
  created_at: string
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
      workspaces: {
        Row: Workspace
        Insert: Partial<Workspace> & { user_id: string; name: string }
        Update: Partial<Workspace>
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
      processing_jobs: {
        Row: ProcessingJob
        Insert: Partial<ProcessingJob> & { document_id: string; user_id: string }
        Update: Partial<ProcessingJob>
        Relationships: []
      }
      extraction_metadata: {
        Row: ExtractionMetadata
        Insert: Partial<ExtractionMetadata> & { document_id: string; user_id: string }
        Update: Partial<ExtractionMetadata>
        Relationships: []
      }
      document_chunks: {
        Row: DocumentChunk
        Insert: Partial<DocumentChunk> & {
          document_id: string
          user_id: string
          chunk_index: number
          content: string
          char_start: number
          char_end: number
          token_count: number
        }
        Update: Partial<DocumentChunk>
        Relationships: []
      }
      embeddings: {
        Row: Embedding
        Insert: Partial<Embedding> & { chunk_id: string; model: string; embedding: number[] }
        Update: Partial<Embedding>
        Relationships: []
      }
      message_embeddings: {
        Row: MessageEmbedding
        Insert: Partial<MessageEmbedding> & { message_id: string; model: string; embedding: number[] }
        Update: Partial<MessageEmbedding>
        Relationships: []
      }
      conversations: {
        Row: Conversation
        Insert: Partial<Conversation> & { user_id: string }
        Update: Partial<Conversation>
        Relationships: []
      }
      messages: {
        Row: Message
        Insert: Partial<Message> & { conversation_id: string; user_id: string; role: MessageRole; content: string }
        Update: Partial<Message>
        Relationships: []
      }
      ai_requests: {
        Row: AiRequest
        Insert: Partial<AiRequest> & {
          user_id: string
          feature: string
          provider: string
          latency_ms: number
          status: AiRequestStatus
        }
        Update: Partial<AiRequest>
        Relationships: []
      }
      reading_progress: {
        Row: ReadingProgress
        Insert: Partial<ReadingProgress> & { document_id: string; user_id: string }
        Update: Partial<ReadingProgress>
        Relationships: []
      }
      highlights: {
        Row: Highlight
        Insert: Partial<Highlight> & { document_id: string; user_id: string; quote: string }
        Update: Partial<Highlight>
        Relationships: []
      }
      chapter_summaries: {
        Row: ChapterSummary
        Insert: Partial<ChapterSummary> & {
          document_id: string
          user_id: string
          chapter_index: number
          content: string
          model: string
        }
        Update: Partial<ChapterSummary>
        Relationships: []
      }
      flashcards: {
        Row: Flashcard
        Insert: Partial<Flashcard> & { document_id: string; user_id: string; front: string; back: string }
        Update: Partial<Flashcard>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_document_id?: string | null
          filter_workspace_id?: string | null
        }
        Returns: { chunk_id: string; document_id: string; content: string; similarity: number }[]
      }
      match_messages: {
        Args: {
          query_embedding: number[]
          match_count?: number
          filter_user_id?: string
          filter_workspace_id?: string | null
        }
        Returns: { message_id: string; conversation_id: string; content: string; similarity: number }[]
      }
    }
    Enums: {
      document_file_type: DocumentFileType
      document_status: DocumentStatus
      processing_status: ProcessingStatus
      message_role: MessageRole
      ai_request_status: AiRequestStatus
    }
  }
}
