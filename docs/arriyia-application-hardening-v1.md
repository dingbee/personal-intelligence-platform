# ARRIYIA Application Hardening & App Experience — v1

Post-10/10, Phase 5 (Application Hardening & App Experience). Baseline: `dingbee/personal-intelligence-platform` @ `main`, `ec7e649` (Phase 4 — ARRIYIA Application & PWA Readiness, `READY WITH HARDENING`).

## 1. Summary

This phase audited ARRIYIA's application lifecycle, app shell, routing, session handling, error recovery, mobile/desktop experience, update strategy, accessibility, and security boundaries, then implemented a small, evidence-justified set of hardening fixes. It did **not** rebuild the UI, add a service worker, or introduce route-level code splitting — none of those were justified by what the audit actually found.

**Status: PASS WITH HARDENING.** Two genuine, concrete defects were found and fixed (no application-wide error boundary; stale query cache surviving logout on shared devices). Everything else audited was either already solid (deep links, mobile safe-area handling, native-dialog focus management, session restoration) or a real-but-low-priority item that's better tracked than rushed (see §16).

## 2. Application Architecture — What Was Audited and Found

Lifecycle: `main.tsx` renders `<App/>` → `AppErrorBoundary` (new, §4) → `QueryClientProvider` → `AuthProvider` → `WorkspaceProvider` → `RouterProvider`. Auth restoration (`AuthContext.tsx`) calls `supabase.auth.getSession()` once on mount, subscribes to `onAuthStateChange`, and exposes a `loading` flag; `ProtectedRoute` shows a full-screen `Spinner` while `loading` is true and redirects to `/login` (preserving the attempted location via `state.from`) once resolved to no session. This is correct and unchanged.

**Two real gaps found:**
- **No error boundary anywhere in the app, and no router `errorElement`.** Confirmed by a repo-wide search — zero matches for `ErrorBoundary`/`componentDidCatch`/`errorElement` before this phase. Any uncaught render error on any route fell through to React Router's generic, unbranded default error page (which also surfaces the raw JS error message). Fixed — see §4.
- **`signOut()` didn't clear the TanStack Query cache**, and query keys (`['notes']`, `['conversations']`, `['messages', id]`, etc.) aren't scoped by user id. On a shared device, a second user signing in after a first user signs out could transiently see the first user's cached data before background refetch overwrote it. Fixed — see §8.

Everything else in the lifecycle — network failure surfacing via TanStack Query's `isError`, AI/edge-function failure handling via `normalizeAiError` (categorized, sanitized, never shows raw provider errors), Supabase session refresh relying on the SDK's own `onAuthStateChange` broadcast — was reviewed and found to already behave correctly for a network-dependent, authenticated application. No changes were made to any of it.

## 3. PWA Experience — What Was Verified

Re-verified against the Phase 4 baseline: `public/manifest.webmanifest`, `public/icons/icon-{192,512}.png`, and the `apple-mobile-web-app-*`/`theme-color`/manifest-link tags in `index.html` are all still present and unchanged by this phase. No new PWA capability was added or claimed.

## 4. Service Worker Decision: **deliberately not implemented**

Re-evaluated from first principles against the app's actual architecture (not merely re-stating the Phase 4 conclusion):

- **Option A — no service worker.** Chosen.
- **Option B — minimal app-shell caching.** Considered and rejected for this phase specifically because it would require a build-time plugin (Vite's output filenames are content-hashed and change every deploy) — a new dependency this phase has no strong justification to add on top of everything else evaluated.
- **Option C — full PWA caching.** Rejected outright: the product's data (documents, notes, conversations, knowledge graph, memory, AI responses, quota) is per-user, authenticated, and either real-time or integrity-sensitive. Caching any of it globally would risk stale-state or cross-session leakage, which this phase's explicit security constraint forbids.
- **Option D — scoped hybrid.** No safe, valuable scope was identified beyond what Option B already covers, so it collapses into the same rejection.

**What changes the calculus versus a naive "add offline support" instinct:** this phase's own new `AppErrorBoundary`/`RouteErrorBoundary` (§5) already catch the one concrete failure mode a stale deploy can cause without a service worker — a dynamic `import()` failing because a hashed chunk from a previous build no longer exists on the server. Previously that would hang or silently fail; now it renders the branded "Something went wrong — Reload" fallback. Combined with the new `vercel.json` cache headers (§10), the update-safety problem a service worker would otherwise need to solve is already adequately handled without one.

## 5. App Shell — What Was Improved

- **`AppErrorBoundary`** (`src/shared/components/errors/AppErrorBoundary.tsx`) — a class-component error boundary (React requires this; no hooks equivalent exists) wrapping the entire app above `QueryClientProvider`. Catches any render/effect error thrown in `AuthProvider`, `WorkspaceProvider`, or anywhere else outside the router's own boundary, and renders a branded fallback instead of unmounting to a blank screen.
- **`RouteErrorBoundary`** (`src/shared/components/errors/RouteErrorBoundary.tsx`) — wired as a single `errorElement` on a new pathless root layout route wrapping the entire existing route tree (`src/app/router.tsx`). Replaces React Router's default error page — which shows the raw error message — with the same branded fallback, and gives unmatched-then-errored routes a distinct "Page not found" message via `isRouteErrorResponse`.
- **`ErrorFallback`** (`src/shared/components/errors/ErrorFallback.tsx`) — the shared presentational component both boundaries render. Deliberately never displays the caught error's message or stack (only `console.error`s it, for diagnosis) — just a generic, safe explanation and a "Reload ARRIYIA" button that does a full navigation to `/`.

No other app-shell change was made — the existing shell (persistent sidebar + `TopBar` + `MobileNavDrawer`, `document.title` set from `appConfig`) was reviewed and found coherent; there was no unnecessary visual flashing or first-load defect to fix.

## 6. Navigation & Deep Links — Findings and Fixes

**No fix needed.** Every protected route category (dashboard, library, documents, notes, knowledge graph, search, settings, memory, chat) is nested under a single `ProtectedRoute`-wrapped layout; the two reader routes (`/library/:documentId/read`, `/library/assets/:assetId`) are separately but identically protected outside the shell. Direct URL entry and browser refresh both work correctly because `ProtectedRoute` re-derives auth state from `supabase.auth.getSession()` on every mount, and `vercel.json`'s SPA catch-all rewrite (unchanged) serves `index.html` for any path so the client router can take over. An expired-session deep link correctly redirects to `/login` with the original path preserved in `state.from`, so login returns the user to where they were headed. The router's own catch-all (`{ path: '*', element: <Navigate to="/" replace /> }`) sends unmatched URLs home rather than showing a dedicated 404 page — reviewed and judged to be reasonable, intentional-looking SPA behavior, not a defect; not changed.

## 7. Mobile Experience — Findings and Fixes

**No new defect found; no change made.** Confirmed substantial pre-existing investment: `MobileNavDrawer` and two other drawers built on shared `EdgeDrawerDialog`, which uses the native `<dialog>` element (`showModal()`) — meaning focus trapping and focus restoration on close are provided by the browser itself, not hand-rolled. `dvh` and `env(safe-area-inset-*)` are used deliberately across `AppShell`, `ChatInput`, `Dialog`, `InsightDrawerShell`, and `ImageReaderPage`, with `viewport-fit=cover` set specifically to make those safe-area values resolve on notched devices. `Dialog.tsx` caps height at `85dvh` specifically to avoid the native `<dialog>` UA-stylesheet clamp misbehaving when the on-screen keyboard is open. Uploads use standard `<input type="file">` plus native HTML5 drag/drop — no experimental API assumptions to break on Android/iOS. The Knowledge Graph canvas and dense spreadsheet grids are inherently denser on small screens, which is a property of that kind of UI, not a defect.

## 8. Desktop Experience — Findings and Fixes

**No new defect found; no change made.** Reviewed sidebar/command-bar/multi-panel layout, resize behavior, and large-screen density — all coherent and unchanged from prior sprints' work. Nothing in this audit surfaced a desktop-specific regression or gap.

## 9. Authentication & Sessions — What Was Verified

- Session restoration, expiration, and logout were traced end-to-end (§2) and found correct.
- **Fixed:** `AuthContext.signOut()` now calls `queryClient.clear()` immediately after `supabase.auth.signOut()` (`src/modules/auth/AuthContext.tsx`), closing the shared-device data-flash gap described in §2. Covered by a new deterministic test (`AuthContext.test.ts`, `describe('AuthContext.signOut')`) asserting cached query data is gone after `signOut()` resolves.
- Multiple tabs/windows on the same origin share `onAuthStateChange` broadcasts via Supabase's own client — unchanged, not PWA-specific, not touched.
- No change was made to signup gating, provider configuration, password handling, Supabase Auth configuration, or redirect allowlists — none was warranted.

## 10. Error Recovery — What Was Improved

`AppErrorBoundary` and `RouteErrorBoundary` (§5) are the substantive improvement here — they turn "uncaught error → blank screen or unbranded default page with a raw error message" into "uncaught error → branded, safe fallback with a working Reload action." Per this phase's own instruction not to scatter generic "try again" buttons everywhere: the existing per-page Supabase-query error handling (e.g. `LibraryPage`'s inline `isError` block) and the AI-specific `normalizeAiError` path were both reviewed and left as-is — they already provide real, working recovery paths (retry via refetch, or a categorized, safe error message), just not through a single shared component. Standardizing ~84 individual error-message call sites into one shared component would be a much larger refactor than this phase's evidence justifies; it's noted as a possible future cleanup, not a defect (see §16).

## 11. Performance — Findings and Improvements

No code-level performance change was made. Re-examined whether route-level lazy loading (flagged as a known, accepted gap since Sprint 9/10 — 1.27 MB uncompressed / ~343 KB gzipped main bundle, zero `React.lazy()` at the route level) is now worth implementing, as this phase's own instructions asked to reconsider explicitly.

**Decision: not implemented in this pass, documented instead.** Converting all ~35 routes to `React.lazy()` boundaries is a broad, mechanical-but-not-risk-free change (export-shape mismatches, Suspense-boundary placement, and interaction with the router restructuring in §5 done in this same pass). Stacking a 35-route conversion on top of a router-shape change in the same commit meaningfully raises regression risk without new evidence that startup time is currently a user-facing complaint — this was already assessed twice before (Sprint 9/10, Sprint 9.5/10) and explicitly deferred as "real regression risk to fix blindly." That reasoning still holds. This is a legitimate candidate for its own narrowly-scoped future phase, not something to fold into a hardening pass.

## 12. Accessibility — Findings and Improvements

No defect found requiring a fix. Both shared dialog primitives (`Dialog.tsx`, `EdgeDrawerDialog.tsx`) use the native `<dialog>` element with `showModal()`, which gives focus trapping, Esc-to-close, and focus restoration on close for free from the browser — not hand-rolled, and not something to second-guess without a demonstrated failure. `aria-label`/`role` attributes are present on the components that need them (`Spinner`, drawers, menus, avatars). No sweep-and-redesign was performed, per this phase's explicit instruction not to redesign components against theoretical concerns when existing semantics are already correct.

## 13. Update Strategy — What Happens on a New Deployment

Two changes address this directly:

1. **`vercel.json` now sets explicit `Cache-Control` headers** (previously none existed, leaving caching entirely to platform defaults): hashed files under `/assets/*` get `public, max-age=31536000, immutable` (safe — Vite gives every content change a new filename), while `index.html`, `manifest.webmanifest`, and `robots.txt` get `public, max-age=0, must-revalidate` so a browser always re-checks for a fresh `index.html` — and therefore fresh references to the current build's hashed assets — rather than being able to cache a stale one indefinitely.
2. **`AppErrorBoundary`/`RouteErrorBoundary`** (§5) catch the residual case where a user's tab was already open across a deploy and a lazy `import()` (component-level lazy loading already exists in `ReaderPage`/`NoteDetailPage`, independent of the route-level question in §11) fails because its chunk no longer exists — the user now sees a working "Reload" prompt instead of a silent failure.

No service worker version-check or elaborate update manager was built — the combination above is judged sufficient for the actual risk, per this phase's explicit instruction not to over-build this.

## 14. Security — Boundaries Confirmed Intact

- No RLS, Supabase Auth configuration, schema, or edge-function change was made anywhere in this phase.
- No service worker or cache of any kind was introduced, so there is no new mechanism that could cross authenticated-data boundaries between users — this is true by construction, not merely asserted.
- The one client-state security gap found and fixed (§9) — stale query cache surviving logout — is closed by `queryClient.clear()`, verified by a deterministic test.
- No secrets were introduced; `vercel.json`'s new `headers` block contains only cache-control values, no credentials or environment-specific data.
- No `localStorage` usage was added; the app's existing `localStorage` use (Supabase's own session token, drawer-collapse UI preferences, per-user `current-workspace:<id>` key) was reviewed and is unchanged.

## 15. Testing

New deterministic tests added (all colocated per repo convention, all passing):

- `src/shared/components/errors/AppErrorBoundary.test.ts` — renders children normally; renders the generic fallback (not the thrown error's message) when a child throws.
- `src/shared/components/errors/RouteErrorBoundary.test.ts` — renders the generic fallback for a route render error; renders a distinct "Page not found" message for an unmatched route.
- `src/modules/auth/AuthContext.test.ts` — new `describe('AuthContext.signOut')` block asserting `queryClient.clear()` runs after `supabase.auth.signOut()`; existing `signUpWithPassword` tests updated to wrap in `QueryClientProvider` (now required since `AuthProvider` calls `useQueryClient()`).

No installability/live-browser smoke test was performed in this phase — Phase 4 already covered manifest/icon validation, and this phase made no PWA-surface change to re-verify.

## 16. Verification Gate

```text
tsc -b       ✅
vitest run   ✅  239/239 test files, 1873/1873 tests passing (5 new)
oxlint       ✅
vite build   ✅  (main bundle ~1272 KB, unchanged within noise of Phase 4's baseline; same pre-existing chunk-size warning, no regression)
```

## 17. Remaining Hardening (explicitly deferred, not silently dropped)

- **Route-level code splitting** — real, known since Sprint 9/10, reconsidered explicitly in §11 and still deferred; a legitimate candidate for its own scoped phase.
- **Inconsistent per-page error messaging** — AI-path errors are categorized/sanitized via `normalizeAiError`; plain Supabase-query errors are shown as raw `error.message` per-page (e.g. `LibraryPage`). Not a security issue (Supabase/PostgREST error text, not secrets), but inconsistent polish across ~84 call sites — worth a dedicated small pass, not this one.
- **Maskable icon** — still deferred from Phase 4, unchanged; no verified safe-zone artwork exists.
- **Declared-but-unloaded brand font** — `--font-sans` in `src/index.css` lists `'Inter'` first, but no `@font-face`/CDN link/package actually loads it, so the browser silently falls back to `system-ui`. Purely cosmetic (no visible defect, no FOUT risk since nothing blocks on a fetch), left untouched rather than adding a font dependency without a design decision behind it.
