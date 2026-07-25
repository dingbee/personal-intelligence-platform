/**
 * Hand-written subset of the Supabase schema used by Milestone 1.
 * Regenerate with the Supabase CLI (`supabase gen types typescript`) once
 * the schema grows past what's practical to hand-maintain.
 */
export interface Profile {
  id: string
  email: string
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
