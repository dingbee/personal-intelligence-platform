# ARRIYIA PWA Readiness — Discovery

Post-10/10, Phase 4 (Application & PWA Readiness Audit). Baseline: `dingbee/personal-intelligence-platform` @ `main`, `3c3803e5811fd006447c553d1f788bce14cc0c78`. This is the discovery record — findings and reasoning only, no implementation decisions. See `docs/arriyia-pwa-readiness-v1.md` for the readiness classification and what was actually implemented.

## 1. Current Application Architecture

**Entry point**: `src/main.tsx` — standard `createRoot(...).render(<StrictMode><App /></StrictMode>)`, no service-worker registration, no PWA install-prompt handling.

**Routing**: `src/app/router.tsx`, `createBrowserRouter` (react-router-dom v7), ~35 routes, all statically imported. **Zero `React.lazy()` usage anywhere in the router** — confirmed by grep (`0` matches). Every route's component ships in the same bundle. This was already flagged as an accepted P2 in Sprint 9/10's performance work (`docs/pip-performance-v1.md`) and Sprint 9.5/10's backlog (`docs/arriyia-personal-release-backlog.md`) — "no route-level code splitting... real performance/architecture fact... no evidence of current user-facing harm." Not new to this audit.

**App shell**: `src/shared/components/layout/AppShell.tsx` — persistent desktop sidebar + `TopBar` + `NovaCommandBar`, with a separate `MobileNavDrawer` for narrow viewports (confirmed via `EdgeDrawerDialog`-based shared drawer infrastructure built in UX-13.6). Ten `.tsx` files already use `dvh`/`env(safe-area-inset-*)` — dynamic-viewport-height and notch-safe-area handling exist and are deliberate (code comments trace this to "PIP Stabilization v1 (P1 mobile)" work across several files: `ChatInput.tsx`, `AppShell.tsx`, `Dialog.tsx`, `InsightDrawerShell.tsx`, `ImageReaderPage.tsx`).

**Authentication/session**: `src/modules/auth/AuthContext.tsx` uses `supabase.auth.getSession()` + `onAuthStateChange` — standard Supabase JS pattern. `src/shared/lib/supabase.ts` creates the client with default options (no explicit `persistSession`/`storage` override), meaning Supabase's own default (`localStorage`, origin-scoped) applies. This is display-mode-agnostic: origin-scoped `localStorage` behaves identically whether the page is opened in a browser tab or an installed standalone-mode window, since both share the same origin and storage partition. Redirect URLs (`emailRedirectTo`, password-reset `redirectTo`) use `window.location.origin`, which resolves correctly in standalone mode too (it's still `document.location`, not a browser-chrome-dependent value).

**Supabase client**: single shared instance (`src/shared/lib/supabase.ts`), used directly by nearly every module for CRUD, and via `supabase.functions.invoke()` for the 5 edge functions. No offline queue, no local mutation cache beyond TanStack Query's in-memory cache (not persisted to IndexedDB/localStorage — confirmed no `persistQueryClient`/`localStoragePersister` in the dependency tree).

**AI runtime communication**: `AIService.sendMessage` (`src/modules/ai/orchestration/AIService.ts`) calls the `ai-chat` edge function, which itself calls Anthropic/OpenAI/Google — a real-time, network-required, streamed request. No local model, no caching of responses beyond what's already persisted to the `messages`/`ai_memory` tables server-side.

**Data fetching/state**: TanStack Query for all server state (in-memory only), local component state for UI. No Redux/Zustand/other global store — confirmed single state-management system, nothing to duplicate.

**Storage**: Supabase Storage (`documents`, `assets` buckets) for uploaded files; browser `localStorage` used only for Supabase's own session token and a handful of UI preference keys (drawer collapse state, per `EdgeDrawerDialog`'s `storageKey` pattern) — nothing sensitive stored client-side beyond the session token itself, which Supabase already manages securely.

**Document handling / readers**: PDF (`pdfjs-dist`, canvas + text layer), EPUB (custom extractor + chapter renderer), spreadsheet (`xlsx` library, in-browser parsing), image (native `<img>` + derivative pipeline). All render from data already fetched — no offline-specific handling exists or is assumed.

**File uploads**: `UploadDropzone.tsx` (documents) and `AssetUploadDropzone.tsx` (images) both use standard `<input type="file">` with an `accept` attribute (extension list / MIME list respectively) plus drag-and-drop via native HTML5 DnD events — no experimental File System Access API usage, no filesystem-persistence assumptions.

**Streaming**: `ai-chat` edge function streams via SSE-style chunked response, consumed by `streamChatCompletion` — a live network stream, not cacheable in any meaningful sense.

## 2. What Is Client-Side vs. Server-Side vs. Network-Dependent

| Concern | Where it lives | Network-dependent? |
|---|---|---|
| UI rendering, routing, component state | Client (React) | No — works once JS is loaded |
| Auth session | Client (`localStorage`, Supabase-managed) | Only for login/refresh; session *read* is local |
| Documents/notes/conversations/memory/graph data | Supabase Postgres | Yes — every read/write is a network round trip |
| File bytes (documents, images) | Supabase Storage | Yes |
| AI chat responses, embeddings, image analysis | Edge functions → provider APIs | Yes — inherently real-time |
| Quota state | Supabase (`quota_usage`) | Yes |
| UI preference (drawer collapse, etc.) | `localStorage` | No |

**Conclusion**: this is a thin, stateless-client application over a network-backed intelligence platform. Almost nothing meaningful can run without a network connection — the "offline value" of a PWA here is fundamentally about *shell resilience* (show something coherent instead of a browser error when the network drops) and *installability* (icon, standalone window), not offline data access. This shapes every later recommendation.

## 3. PWA Capability Audit (Phase 2)

Inspected directly, not assumed:

| Capability | Status (before this phase) |
|---|---|
| Web App Manifest | **Missing** |
| Service worker | **Missing** |
| Installability | **Missing** (no manifest → not installable) |
| HTTPS assumption | N/A in-repo — Vercel serves HTTPS by default; no code assumes `http://` |
| Application icons | Only `public/favicon.svg` (browser tab icon); no PNG icon set |
| Maskable icons | **Missing** |
| Splash/startup config | **Missing** (a subset of manifest fields) |
| Standalone display mode | **Missing** (manifest `display` field) |
| Theme/background colors | Only a `<meta name="theme-color">`-less page; app itself has `--color-canvas` CSS tokens (`#fafaf9` light / `#1c1917` dark) |
| App name/short name | Only `<title>` (`ARRIYIA`, set Phase 2/3) |
| Scope/start URL | **Missing** |
| Update strategy | N/A — no service worker to update |
| Offline fallback | **Missing** |
| Cache strategy / runtime caching / asset caching | **Missing** |
| Navigation fallback | Already effectively present via `vercel.json`'s SPA catch-all rewrite (`/(.*) → /index.html`), but that's a *server-side* fallback for direct URL loads, not a service-worker offline fallback |
| Install prompts | **Missing** (no `beforeinstallprompt` handling) |
| PWA-related Vite config | **Missing** — no `vite-plugin-pwa` or equivalent in `vite.config.ts`/`package.json` |
| Existing PWA dependencies | **None** — `package.json` has zero PWA-related packages |

## 4. Mobile Experience — What Already Exists

Not starting from zero. Confirmed via code and prior sprint history (many "PIP Stabilization v1 (P1 mobile)" fixes already shipped):

- Dedicated `MobileNavDrawer` (distinct from desktop `Sidebar`), built on shared `EdgeDrawerDialog` (outside-click close, consistent behavior across 3+ drawer instances).
- `dvh` units and `env(safe-area-inset-*)` used deliberately in `AppShell`, `ChatInput`, `Dialog`, `InsightDrawerShell`, `ImageReaderPage` — notch/home-indicator-safe layout already addressed, not theoretical.
- Reader mobile layout unification (`activePanel` state model) shipped specifically to fix a mobile-only reading/chat-panel conflict (Sprint history: "Implement Reader mobile layout (activePanel unification)").
- Mobile image upload had a real, fixed bug ("File is empty" on mobile — Sprint history confirms this shipped).
- `viewport-fit=cover` already set in `index.html`'s viewport meta tag specifically to enable safe-area env() variables.

This means Phase 3 (mobile experience) of this audit is validating and extending existing, demonstrated mobile investment — not starting a mobile-readiness effort from scratch.

## 5. Known, Already-Documented Performance Facts (not rediscovered here)

From Sprint 9/10 and Sprint 9.5/10's own audits, still true at this baseline:

- Main JS bundle: ~1.27 MB uncompressed / ~342 KB gzipped (`dist/assets/index-*.js`) — a single chunk-size warning on every build, unchanged.
- No route-level code splitting.
- These were explicitly accepted as P2 ("no evidence of current user-facing harm... real regression risk" to fix blindly) in the pre-freeze backlog, not fixed in Sprints 1-10 or Phases 1-3.

This audit's Phase 4 (Responsive Performance) treats these as **already-known, not newly discovered** — relevant to PWA readiness because they affect first-load time on constrained mobile connections, which matters more for an installed app users expect to open instantly.

## 6. Documentation Reviewed

`docs/arriyia-rebranding-forensic-audit.md`, Phase 2 commit `4fd6527` diff, Phase 3 commit `3c3803e` diff, `docs/manual/*` (all 9 chapters — none currently document install/offline/mobile-app behavior, since none exists), `docs/feature-matrix.md` (no PWA-related row exists), `package.json`, `vite.config.ts`, `src/app/router.tsx`, `src/app/App.tsx`, `src/shared/lib/supabase.ts`, `src/modules/auth/AuthContext.tsx`, existing `index.html`/manifest/icon state (per Phase 3).

No second frontend architecture, state-management system, or caching system was found to exist already — none is proposed here either.
