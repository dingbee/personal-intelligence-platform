const RELOAD_ATTEMPTED_KEY = 'arriyia:chunk-reload-attempted'

/**
 * Vite/Rollup emits one hashed filename per chunk per build; Vercel serves
 * `/assets/*` as `immutable, max-age=31536000` and swaps the production
 * domain over to an entirely new asset directory on every deploy (there is
 * no cross-deployment fallback). A tab that was already open before a
 * deploy landed still holds a module graph pointing at the *previous*
 * deployment's hashed chunk URLs — the first time that tab tries a dynamic
 * `import()` it hasn't already resolved (a lazy route, a lazily-loaded
 * processor), the browser requests a URL that simply no longer exists,
 * and every major browser surfaces some variant of this exact message.
 */
const CHUNK_LOAD_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed/i

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR_PATTERN.test(error.message)
}

function hasAlreadyAttemptedReload(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_ATTEMPTED_KEY) === '1'
  } catch {
    // Storage unavailable (private browsing, disabled cookies, etc.) — fail
    // safe by treating this as "already attempted" so we never risk an
    // unbounded reload loop when we can't durably record that we tried.
    return true
  }
}

function markReloadAttempted(): void {
  try {
    sessionStorage.setItem(RELOAD_ATTEMPTED_KEY, '1')
  } catch {
    // Best effort — if this can't be recorded, hasAlreadyAttemptedReload()
    // above already fails safe by refusing to reload at all.
  }
}

/**
 * Wraps a dynamic-import loader with one-shot recovery from a stale chunk
 * reference. On the first chunk-load failure in this tab's lifetime, does
 * a real page reload to pick up the current deployment's asset manifest —
 * `sessionStorage` (not an in-memory flag) is what makes this a genuine
 * *one*-shot guard, since a plain module variable would itself be wiped by
 * the reload it's supposed to prevent repeating. Any subsequent chunk-load
 * failure in the same tab (including one hit immediately after the reload,
 * meaning the chunk is genuinely missing even in the current deployment)
 * is left to propagate normally — this never masks a real, persistent
 * module error, and never reloads more than once per tab session.
 */
export async function loadResilientChunk<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    if (isChunkLoadError(error) && !hasAlreadyAttemptedReload()) {
      markReloadAttempted()
      window.location.reload()
    }
    throw error
  }
}
