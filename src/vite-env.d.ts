/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional canonical app origin (e.g. https://app.nolmark.co) used for Supabase Auth redirect URLs instead of window.location.origin, so auth emails always point at the canonical domain regardless of which domain served the page that requested them. */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
