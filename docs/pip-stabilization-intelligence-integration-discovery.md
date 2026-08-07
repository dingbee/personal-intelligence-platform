# PIP Stabilization & Intelligence Integration v1 — Discovery Report

Read-only audit performed before any implementation, per this milestone's own Phase 1 instruction. Covers all three observed issues. No code was changed while producing this report.

---

## P0 — Image → Chat Intelligence Integration

### Full lifecycle trace

1. **Upload.** `AssetUploadDropzone.tsx` → `useAssets().upload` → `uploadAsset()` (`assets/api/assets.ts:82`). Title defaults to `params.title?.trim() || params.file.name.replace(/\.[^/.]+$/, '')` — **the filename minus extension**, not a database id.
2. **Asset creation.** A row is inserted into `assets` with `metadata: null`. Nothing downstream is triggered — `upload`'s `onSuccess` only calls `invalidate()` (`useAssets.ts:24`).
3. **Asset metadata / analyzeImage / extractedText / detectedLanguage / confidence.** All of this exists and works (`analyzeImage.ts`, Multimodal Intelligence v1/v2) — but is **only ever invoked from one place**: the "Analyze with NOVA" button inside `ImageReaderPage.tsx`'s Chat tab (`useAnalyzeImage`, referenced only in `ImageReaderPage.tsx`). Grepping the whole `assets` module confirms `useAnalyzeImage`/`analyzeImage` has no other call site. **A freshly uploaded image has `metadata: null` until a human opens it and clicks a button most users will never discover.**
4. **Visual knowledge extraction / asset_embeddings / indexing.** Both are chained *inside* `useAnalyzeImage`'s composition (`runKnowledgeExtractionFromContent`, `indexAsset`) — so they inherit the same gate as #3: nothing runs until "Analyze with NOVA" is clicked.
5. **Universal Search.** `assetSearchProvider` (Knowledge Intelligence Layer v1) correctly finds analyzed images — but it is registered only in `searchProviderRegistry`, consumed only by `runUniversalSearch`, consumed only by the standalone `/search` page (`SearchPage.tsx`). **`runUniversalSearch` has no caller anywhere in the chat pipeline.**
6. **ImageReaderPage → Chat entry point.** The "Ask NOVA about this image" button (`ImageReaderPage.tsx:248`) calls `createConversationWithQuery(\`I'd like to talk about an image called "${asset.title}".\`)` — **unconditionally**, whether or not `asset.metadata` exists. Even after a successful analysis, this seed message never includes the description, extracted text, or any analyzed content — only the (often meaningless, filename-derived) title.
7. **ChatPage.** `initialQuery` (the seeded text) is sent via the exact same `handleSend`/`useSendMessage` path as anything typed by hand (`ChatPage.tsx:277-290`) — confirmed to be the same pipeline, not a second one.
8. **ReaderChatPanel.** Takes a required `documentId: string` prop and scopes `retrieveContext({ documentId })` to it (`ReaderChatPanel.tsx:71,106`). `ImageReaderPage` does **not** use `ReaderChatPanel` at all — images get a plain, unscoped new-conversation flow instead, structurally weaker than what documents get in the Reader.
9. **Conversation → context retrieval → prompt assembly (`AIService.sendMessage`).** This is the actual break, confirmed by reading the full function (`AIService.ts:78-241`):
   - `retrieveContext()` (line 131) calls `supabaseVectorStore.query()`, which is **hardcoded** to the `match_document_chunks` RPC (`SupabaseVectorStore.ts:24-29`) — it has no concept of `asset_embeddings`/`match_assets` at all. **An image's analyzed content can never be found by chat's RAG retrieval, regardless of whether analysis ran.**
   - `retrieveGraphContext()` (line 136-140) is scoped to `documentIds: [...new Set(matches.map(m => m.documentId))]` — i.e. only the documents the (document-only) vector search already matched — and its own query additionally filters `knowledge_node_sources.eq('source_type', 'document')` (`retrieveGraphContext.ts:83`), explicitly excluding `source_type: 'asset'` rows even in the hypothetical case an asset id reached it.
   - Together, these mean the chat prompt assembled in `buildSystemPrompt()` (line 147) **never contains a single word about any image**, however well the vision/extraction/indexing pipeline worked.
10. **ai-chat Edge Function / provider content blocks.** `messages: [...history, { role: 'user', content: text }]` (line 193) — `text` is always a plain string on this path. `ChatContentPart[]` (built in Multimodal v1) is used **only** by `analyzeImage.ts`'s one-shot vision call via `streamChatCompletion` directly, never by the ongoing chat path. **This is confirmed to be a deliberate, already-documented scope boundary from Multimodal Intelligence v1/v2** ("NOVA can be asked to look once, not mid-conversation") — not a bug, and this milestone's fix does not change it: an image's *description* (text), not its raw pixels, is what should reach ongoing chat, via the same RAG mechanism documents already use.
11. **Final response.** With zero evidence reaching the prompt and only a bare (often filename-shaped) title in the seed message, the model has nothing to answer from — which produces exactly the reported "I don't have any information in your documents about an image with the identifier '1000552373'."

### Root causes (four, compounding)

| # | Root cause | Where |
|---|---|---|
| A | Chat's only RAG source (`retrieveContext`) is hardcoded to `document_chunks` — structurally blind to `asset_embeddings`, regardless of analysis state. | `AIService.ts:131`, `SupabaseVectorStore.ts` |
| B | `retrieveGraphContext` filters `source_type = 'document'` and is scoped only to document-vector-search hits — structurally blind to asset-sourced knowledge nodes. | `retrieveGraphContext.ts:83`, `AIService.ts:136-140` |
| C | `ImageReaderPage`'s chat entry point seeds the conversation with only a bare title, never the analyzed content, even when it exists. | `ImageReaderPage.tsx:248` |
| D | Vision analysis is 100% manual (one button, one page) — never triggered by upload. A fresh upload has no description, no text, no knowledge nodes, no embeddings at all. | `useAssets.ts`, `AssetUploadDropzone.tsx` |

Root cause D explains the reported bug directly (a fresh upload, asked about immediately, has nothing computed yet). Root causes A and B are the deeper, more serious problem: **even after fixing D, a well-analyzed image still could not be found by ongoing chat**, because the retrieval layer itself never learned assets exist. All four must be fixed together for the milestone's own expected flow to actually hold.

### What is NOT the problem (verified, not assumed)

- Vision analysis, OCR/text extraction, confidence scoring, and knowledge extraction (Multimodal Intelligence v1/v2) all work correctly once triggered — read in full, no defects found.
- `assetSearchProvider`/Universal Search correctly finds analyzed images — it's just never called from chat.
- The `ChatProviderMessage`/`ChatContentPart[]` multimodal plumbing works and is intentionally not used for ongoing chat turns (a documented product decision, not a gap).
- `ReaderChatPanel` and `ChatPage` both funnel through the identical `AIService.sendMessage` — they don't "behave differently" in the sense of divergent bugs; they share the exact same root cause.

---

## P1 — Beta Invite Email Delivery

**Verdict: email delivery is fully missing — never implemented.** Everything upstream (creation, RLS, the anti-abuse gate) works correctly.

- **Creation stops at a DB row.** `AdminDashboardPage.tsx:66-83` → `useAdminCreateBetaInvite` (`useAdminData.ts:26-34`) → `adminCreateBetaInvite` (`adminApi.ts:17-31`) → `admin_create_beta_invite` RPC (`supabase/migrations/0035_platform_admin_foundation.sql:148-183`), which does exactly one `insert into beta_invites` (line 174). No trigger on `beta_invites` exists. No follow-up call of any kind happens after the insert.
- **A working, reusable pattern already exists — for workspace invitations, not beta invites.** `supabase/functions/send-workspace-invitation/index.ts` (258 lines) is a complete, correct implementation: validates the caller's JWT, authorizes via `has_workspace_role`, builds the email via `buildInvitationEmail.ts`, and sends it through the Resend HTTP API (`fetch('https://api.resend.com/emails', ...)`). Called from `workspaceMembers.ts:144-164`. This is the template to reuse, not rebuild.
- **Secrets:** `RESEND_API_KEY` (required), `RESEND_FROM_EMAIL` (optional, defaults to `onboarding@resend.dev`), `SITE_URL` (optional, falls back to the request's `Origin` header) — all referenced only inside `send-workspace-invitation`. No beta-invite code references any email-related secret, because no beta-invite code calls an edge function at all. (Whether `RESEND_API_KEY` is actually *set* in this deployment could not be determined from source and is a manual-verification item — see below.)
- **Acceptance is email-match based, not token-based.** There is no `?invite=`/`?token=` param anywhere in `src/modules/auth/`. `enforce_beta_invite_gate()` (a `BEFORE INSERT` trigger on `auth.users`, `0034_beta_invite_quota_repair.sql:79-103`) checks the signup email against `beta_invites.email` directly. **This means the fix only needs to deliver a link to `/signup` (optionally `?email=` prefilled) — no new acceptance mechanism is needed.**
- **The uninvited-user gate is server-side, unconditional, and has zero dependency on email.** `enforce_beta_invite_gate()` blocks any signup path (password, magic link, admin-created) unless a matching `beta_invites` row with `status = 'invited'` exists. Confirmed: **a fix that only adds email sending does not need to touch this gate, `is_beta_invited()`, `beta_invites` RLS, or any of `0034`/`0035`'s migrations.**

---

## P1 — iPhone / Mobile UI Diagnosis

Read-only audit. No mixing of `vh`/`dvh` conventions exists to reconcile — the codebase is **uniformly** `100vh`/`h-screen`, with **zero** occurrences of `dvh`, `env(safe-area-inset-*)`, or `-webkit-fill-available` anywhere, and `index.html`'s viewport meta tag has no `viewport-fit=cover`. This is virgin territory, not an inconsistency between competing patterns.

**Ranked, concrete risks found (all read in full, not inferred):**

1. **`ChatPage.tsx:301`** — `h-[calc(100vh-3.5rem)]`, nested *inside* `AppShell`'s own `h-screen` (`AppShell.tsx:29`), assuming `TopBar` is exactly `3.5rem` tall. `TopBar.tsx` has **no fixed-height class** — it's a two-row header (icon row + greeting row) that is always taller than 56px on mobile, unlike `ReaderPage.tsx:213`/`ImageReaderPage.tsx:130`, which both correctly declare `h-14 shrink-0` to make the equivalent assumption true. **This is the strongest single candidate for "the message composer is cut off / not visible on iPhone without scrolling."**
2. **`ImageReaderPage.tsx:183`** — the image `<img>` renders at `width: ${asset.width * zoom}px` with `maxWidth: 'none'` explicitly defeating any container clamp, at a default `zoom = 1`. Most photos are wider than a phone screen, so images open already needing horizontal scroll — unlike `PdfReaderView`, which defaults to fit-width.
3. **`ReaderPage.tsx:220-269`** and **`ImageReaderPage.tsx:138-172`** — header control clusters (page/progress indicator + up to 4-6 buttons) are un-wrapped, `shrink-0`, with no `overflow-x-auto` — a concrete overflow/clipping candidate on a 375px viewport.
4. No `env(safe-area-inset-bottom)` anywhere — not yet a visible bug (there's no bottom nav bar to collide with), but `ChatInput`'s bottom padding and `InsightDrawerShell`'s minimized-state pill are both blind to the home-indicator safe area on notched iPhones.
5. `Dialog.tsx` relies entirely on the native `<dialog>` UA-stylesheet height clamp (computed against the layout viewport, not the visual one) with no explicit `max-h-[...]` — lower-confidence, worth a manual check when the keyboard is open.

**What's already solid (confirmed, not touched):** `EdgeDrawerDialog` gives all three mobile drawers (nav, conversations, collections) identical correct behavior; `GraphCanvas`/`SpreadsheetGridView`/both admin `<table>`s already wrap wide content in `overflow-x-auto`; `ReaderPage`'s `activePanel` single-panel-at-a-time mobile pattern is a deliberate, already-correct design (and — notably — the Reader's own embedded chat does **not** share ChatPage's height-arithmetic bug, since `ReaderPage` is a top-level route with one `h-screen`, not nested inside `AppShell`'s); `NovaCommandBar` already goes full-screen correctly on mobile via `h-full`/`inset-0` rather than a raw `vh` calc. No prior mobile-specific discovery exists to duplicate — `docs/ux-15.3.1-dark-mode-polish-discovery.md` is scoped entirely to color/contrast, confirmed by reading it in full.
