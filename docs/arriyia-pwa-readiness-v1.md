# ARRIYIA PWA Readiness — v1

Post-10/10, Phase 4 (Application & PWA Readiness Audit). Baseline: `dingbee/personal-intelligence-platform` @ `main`, `3c3803e5811fd006447c553d1f788bce14cc0c78`. This is the readiness classification and implementation record. See `docs/arriyia-pwa-readiness-v1-discovery.md` for the underlying architecture discovery this is built on.

## 1. Summary

ARRIYIA is a network-backed intelligence platform (Supabase Postgres/Auth/Storage + edge functions calling AI providers), not a data-heavy offline-first app. Its "PWA readiness" is fundamentally about **installability and app-like chrome**, not offline data access — almost nothing in the product (documents, notes, conversations, knowledge graph, memory, AI responses) can safely or meaningfully run without a network connection, and the discovery audit found no evidence this should change.

Classification: **READY WITH HARDENING** (see §10 for the full matrix). The low-risk, high-value pieces — manifest, real icons, install metadata — have been implemented in this phase. A service worker was evaluated and deliberately deferred (§6): the app's real-time, per-user, security-sensitive data model leaves almost nothing that's both safe and valuable to cache, and a hand-rolled precache against Vite's hashed build output would be a maintenance liability without a build-time plugin, which this phase declines to add without stronger justification than "PWAs usually have one."

## 2. PWA Capability Audit — Before / After This Phase

| Capability | Before | After this phase |
|---|---|---|
| Web App Manifest | Missing | **Implemented** (`public/manifest.webmanifest`) |
| Application icons (192/512 PNG) | Missing (only `favicon.svg`) | **Implemented** — rasterized from the existing brand mark |
| Maskable icon | Missing | Still missing — no safe-zone-verified artwork exists; not fabricated here |
| Installability | Missing (no manifest) | **Implemented** — manifest + icons + `<link rel="manifest">` |
| Standalone display mode | Missing | **Implemented** (`display: "standalone"`) |
| Theme/background color | Missing | **Implemented**, matched to the app's actual `--color-canvas` dark token (`#1c1917`) |
| App name/short name/description | Only `<title>` | **Implemented**, sourced from `appConfig` (single source of truth) |
| Scope/start URL | Missing | **Implemented** (`/`, root-relative, no hardcoded domain) |
| `apple-mobile-web-app-*` meta (iOS install support) | Missing | **Implemented** — iOS Safari ignores the manifest for some of this |
| Service worker | Missing | **Deliberately deferred** — see §6 |
| Offline fallback / runtime caching | Missing | **Deliberately deferred** — see §6 |
| Navigation fallback for direct URL loads | Present | Unchanged — already handled server-side by `vercel.json`'s SPA catch-all rewrite |
| Install prompts (`beforeinstallprompt` UI) | Missing | Not added — manifest+icons alone make Chrome/Edge's native install affordance available; a custom prompt UI is optional polish, not a readiness blocker |
| Route-level code splitting | Missing | Not added this phase — real, known, pre-existing finding (§5); out of scope for a "PWA readiness" audit unless it were blocking installability, which it isn't |

## 3. Mobile Experience

Not starting from zero (`docs/arriyia-pwa-readiness-v1-discovery.md` §4 has the full inventory). Confirmed already in place, not newly built:

- A dedicated `MobileNavDrawer`, distinct from the desktop `Sidebar`, on shared `EdgeDrawerDialog` infrastructure (outside-click close, consistent behavior across drawers).
- `dvh` units and `env(safe-area-inset-*)` deliberately used across 10 files (`AppShell`, `ChatInput`, `Dialog`, `InsightDrawerShell`, `ImageReaderPage`, etc.) — real notch/home-indicator handling, not theoretical.
- `viewport-fit=cover` already set specifically to make those safe-area env() variables resolve to non-zero values.
- A real, previously-shipped fix for a mobile-only image-upload bug ("File is empty" on mobile), and a real mobile layout unification for the Reader's chat/content panel conflict.

No new mobile blocker was found during this audit across the core surfaces (Dashboard/Hub, Library, Reader, Notes, Conversations, Chat, Search, Knowledge Graph, Memory, Settings). File uploads use standard `<input type="file">` + native HTML5 drag/drop with `accept` filters — no experimental File System Access API assumptions that would misbehave on Android/iOS. The one interaction class worth naming as inherently desktop-leaning is the Knowledge Graph's node-drag/zoom canvas and dense spreadsheet grids — these already have scroll/pan fallbacks for touch and were not flagged as broken, only as "denser" on small screens, which is a design characteristic of graph/spreadsheet UIs generally, not a defect to fix here.

## 4. Responsive Performance

No new findings. This phase treats Sprint 9/10 and 9.5/10's own performance audit as authoritative and current:

- Main JS bundle ~1.27 MB uncompressed / ~342 KB gzipped, single chunk, no route-level code splitting (confirmed still true — zero `React.lazy()` calls in `src/app/router.tsx` as of this baseline).
- This was already explicitly accepted as P2 ("no evidence of current user-facing harm... real regression risk to fix blindly") in the pre-freeze backlog (`docs/arriyia-personal-release-backlog.md`), not fixed across Sprints 1–10 or Phases 1–3.

Relevance to PWA readiness specifically: a larger first-load bundle matters more once users expect an *installed app* to open instantly from a home-screen icon. It is not, however, a blocker to shipping a manifest and installability — it's a legitimate future hardening item, tracked here rather than fixed opportunistically in an audit phase.

## 5. Offline Capability Classification

**Category A — Must work offline:** Nothing beyond the static app shell (HTML/CSS/JS chrome) *would* qualify once a service worker exists to serve it; today, with no service worker, the app shell also requires network on first paint. No regression — this is the same as before the audit.

**Category B — Could work offline (if implemented later, with care):** Static asset shell precaching (JS/CSS/icons/manifest) for instant reopen of an already-visited install. Nothing data-bearing belongs here without a scoped, explicitly-secure architecture that doesn't exist yet (see §6).

**Category C — Requires network (the large majority of the product):** Documents/notes/conversations/knowledge graph/memory (all Supabase Postgres reads/writes), file bytes (Supabase Storage), AI chat/embeddings/image analysis (edge functions → provider APIs, inherently real-time and streamed), quota state.

**Category D — Should remain online-only, even if technically cacheable:** Anything authenticated or per-user. Caching an authenticated Supabase response, even "just for offline convenience," creates exactly the kind of stale-state/data-integrity/cross-user-exposure risk this audit was explicitly told to guard against. No such caching exists, and none is proposed.

## 6. Service Worker Strategy — Deferred

**Decision: do not implement a service worker in this phase.**

Reasoning:

1. **Almost nothing is safely cacheable.** Per §5, the overwhelming majority of the product's value is per-user, authenticated, real-time Supabase/AI data — explicitly excluded from caching by this audit's own security constraint (§8). What's left to cache is the static shell, which has low marginal value: the app is not meaningfully usable offline even with the shell cached, since every real feature still needs the network.
2. **Vite's hashed output makes a hand-rolled precache list fragile.** Build filenames (`index-<hash>.js`, etc.) change on every build; a manually maintained cache list would silently go stale or 404. The standard fix is a build-time plugin (e.g. `vite-plugin-pwa`), which is a new dependency — something this phase was explicitly told not to add without strong justification, and "the app doesn't have a service worker yet" is not, by itself, strong justification.
3. **The value that exists (instant shell reopen) is real but not urgent.** It's a legitimate future improvement, not a release blocker — nothing in the discovery audit found the *absence* of a service worker breaking installability, auth, or core functionality.

This is a scoped, revisitable decision, not a permanent one. A future phase that specifically wants offline shell resilience should introduce `vite-plugin-pwa` (or equivalent) deliberately, with its own scoped discovery/implementation/verification cycle — not bolt one on inside a readiness audit.

## 7. Authentication & Session Behavior Under Standalone Mode

No defect found; no change made. Findings:

- Supabase's default session persistence (`localStorage`, origin-scoped) is display-mode-agnostic: an installed standalone window and a browser tab on the same origin share the same storage partition, so login state carries over identically either way.
- `emailRedirectTo`/password-reset `redirectTo` both use `window.location.origin`, which resolves correctly in standalone mode (it's `document.location`, not something that depends on browser chrome being visible).
- No OAuth providers are configured (confirmed via `AuthContext.tsx` — email/password + magic link + password reset only), so there's no OAuth-popup-vs-standalone-window interaction to worry about.
- Multi-tab/multi-window behavior (an installed window open alongside a browser tab on the same origin) follows Supabase's own `onAuthStateChange` broadcast behavior — unchanged, unaudited-as-new since it isn't PWA-specific.

No changes to signup gating, provider configuration, password handling, Supabase Auth configuration, or redirect allowlists were made or are recommended.

## 8. Files & Local Device Capabilities

- Uploads (documents, images, spreadsheets, EPUBs) use standard `<input type="file">` with `accept` filters plus native HTML5 drag-and-drop — no experimental File System Access API usage, so behavior is consistent across desktop, Android, and iOS/iPadOS without relying on any API with partial browser support.
- `.nova` export/import (`src/modules/export/`) is unaffected by this phase — the `format: 'nova'` discriminator and `.nova` extension are untouched, preserving round-trip compatibility with already-exported files.
- No claim is made here about native filesystem access, background sync, or persistent local file handles — the browser doesn't reliably offer these across platforms, and the product doesn't depend on them.

## 9. Notifications

**Not currently required.** The only "notifications" surface in the codebase today is a UI bell icon in `TopBar.tsx` with a static "No notifications yet" placeholder — not wired to any event source, and no push subscription/`Notification` API usage exists anywhere in `src/`. There is no product requirement identified in this audit (document-processing completion, analysis completion, security events, etc. are plausible future candidates, but none is being built speculatively here). Push notification infrastructure was not introduced.

## 10. Decision Matrix

| Capability | Current | Required for PWA | Priority | Recommendation |
|---|---|---|---|---|
| Manifest | Implemented | Yes | P0 | Done this phase |
| Icons (192/512 PNG) | Implemented | Yes | P0 | Done this phase |
| Installability | Implemented | Yes | P0 | Done this phase |
| Theme/background color, name/description | Implemented | Yes | P0 | Done this phase |
| `apple-mobile-web-app-*` meta | Implemented | Yes (iOS) | P0 | Done this phase |
| Service worker | Missing | Optional | P2 | Deferred — see §6 |
| Offline shell caching | Missing | Optional | P2 | Deferred — see §6 |
| Maskable icon | Missing | Optional | P3 | Deferred — needs verified safe-zone artwork, not fabricated here |
| Mobile UX | Adequate (pre-existing investment) | Yes | — | No action needed |
| Desktop UX | Adequate | Yes | — | No action needed |
| Authentication | Compatible as-is | Yes | — | No action needed |
| File handling / `.nova` | Compatible as-is | Yes | — | No action needed, preserved |
| Notifications | Not built | No | — | Not currently required |
| Route-level code splitting | Missing | No (perf, not installability) | P2 | Tracked from Sprint 9/10, unchanged, out of this phase's scope |
| Security preservation | Verified — no new surface added | Yes | — | See §11 |

### Overall classification: READY WITH HARDENING

The application can be installed as a genuine app-like PWA today with what this phase implemented (manifest, icons, standalone display, install metadata). It is not **READY** unconditionally because two real, identified improvements remain deliberately unimplemented (service worker/offline shell, route-level code splitting) — both are real, both are optional, and shipping without them creates no functional or security defect. It is not **NOT READY**, because no architectural blocker, security gap, or broken core flow was found anywhere in the audit.

## 11. Data & Security Preservation

Explicitly verified, per this phase's own required constraint:

- **No service worker was implemented in this phase**, so there is no cache, IndexedDB layer, or offline mechanism of any kind that could expose one user's data to another — the question is moot by construction, not merely asserted.
- No change was made to RLS, workspace isolation, authentication, memory boundaries, document ownership, quota enforcement, provider isolation, prompt-injection protections, or account deletion. These were verified as sound in Sprint 10/10's own security review (`docs/pip-final-platform-validation-v1.md`) and this phase touched none of the code paths that review covers.
- `.nova` compatibility is preserved (§8) — no format or extension change.
- If a future phase introduces offline shell caching per §6, its cache must be scoped to static, non-authenticated assets only (JS/CSS/manifest/icons) — this document records that constraint for whoever picks the work back up.

## 12. Economics & Resource Usage

The changes in this phase add two small static PNG files (~8 KB and ~40 KB) and a small JSON manifest to the deployed asset set — served once per browser cache lifetime, not per request, and not a measurable bandwidth/storage concern. No new Supabase reads, AI calls, embedding calls, or background sync were introduced (none exist). No hidden recurring cost was created. Deferring the service worker (§6) specifically avoids the cost/complexity of a caching layer that would need its own invalidation/versioning logic for no proportionate benefit yet.

## 13. Browser Compatibility

| Surface | Chrome/Edge (desktop) | Firefox (desktop) | Safari (desktop) | Android Chrome | iOS Safari |
|---|---|---|---|---|---|
| Manifest parsing | Supported | Supported | Partial (Safari ignores several fields) | Supported | Partial — this is exactly why `apple-mobile-web-app-*` meta tags were added |
| Native install prompt | Supported (`beforeinstallprompt`) | Not supported (no native install UI) | Not supported the same way — installs via Share → Add to Home Screen | Supported | Add to Home Screen only, no `beforeinstallprompt` |
| Standalone display mode | Supported | N/A (no install) | Supported once added to home screen | Supported | Supported once added to home screen |
| Maskable icons | Supported | N/A | Not applicable (Safari doesn't use manifest icon `purpose`) | Supported | N/A |

These are documented browser platform behaviors, not something verified via live cross-browser testing in this session — no claim of tested compatibility is made beyond what's stated in §14.

## 14. Implementation Performed This Phase

- `public/manifest.webmanifest` — new. `name`/`short_name`/`description` sourced from the approved ARRIYIA identity (matches `appConfig.productName`/`productSubtitle`); `start_url`/`scope` are root-relative (`/`), no domain hardcoded; `display: "standalone"`; `theme_color`/`background_color` matched to the app's real dark-canvas CSS token (`#1c1917`); icon set includes 192×192 and 512×512 PNG plus the existing SVG favicon.
- `public/icons/icon-192.png`, `public/icons/icon-512.png` — new. Rasterized directly from the existing, already-approved `public/favicon.svg` brand mark via a headless-Chromium screenshot (Playwright) — not invented artwork — on a background matching the manifest's `background_color`.
- `index.html` — added `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`, and the `apple-mobile-web-app-*` meta trio needed for iOS Safari installability (which does not read the manifest for these).
- `src/app/manifest.test.ts` — new. Deterministic test reading `public/manifest.webmanifest` off disk and asserting: valid JSON with required fields present; identity fields match `appConfig` (the single source of truth, so a future rename can't silently desync manifest from app); no hardcoded origin in `start_url`/`scope`/icon `src`; `display: "standalone"`; theme/background color consistency; both required PNG icon sizes present; no unverified maskable-icon claim.

## 15. Implementation Deliberately Deferred

- **Service worker / offline shell caching** — see §6 for full reasoning. Tracked as a scoped future improvement, not a defect.
- **Maskable icon** — would require verified safe-zone padding on the brand mark; not fabricated in this phase.
- **Custom install-prompt UI** (`beforeinstallprompt` handling) — optional polish; the platform-native install affordance already works once the manifest exists.
- **Route-level code splitting** — real, pre-existing, already-tracked Sprint 9/10 finding; out of scope for this readiness audit since it's a performance concern, not an installability blocker.
- **Push notifications** — no product requirement identified; not built speculatively.

## 16. Recommended Next Step

Ship the current state (manifest + icons + install metadata) — it makes ARRIYIA genuinely installable today with no security or architectural cost. Treat the service worker/offline-shell work and route-level code splitting as two independent, separately-scoped future phases, each with its own discovery pass, rather than folding them into this audit. Neither is release-blocking.
