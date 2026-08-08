# PIP Multimodal Intelligence Stabilization v1 — Discovery Report

Read-only audit performed before any implementation. Covers all three observed problems. No code was changed while producing this report; the one edge-function deployment described below (`ai-chat`) was the first implementation action taken, immediately after the finding that made it necessary was confirmed.

---

## A. Working normal-chat path

`ChatPage.tsx` → `useSendMessage(providerId)` → `useProviderChain(providerId)` (composes `useProviderAvailability`, `useProviderOverrides`, `usePlatformProviderSettings`, `useAiHealth('7d')` into `resolveProviderChain(...)`) → `sendMessage()` in `AIService.ts` → `streamChatCompletion({ provider: getChatProvider(chain[0]), ... })` → `openaiChatProvider.chat()` → `streamAiChat()` (`edgeFunctionClient.ts`, a raw `fetch` against the `ai-chat` Edge Function, not `supabase.functions.invoke`, so the stream can be read incrementally) → the deployed `ai-chat` function → OpenAI's real Chat Completions API → normalized SSE stream back to the client.

## B. Failing image path (before the fix)

`ImageReaderPage.tsx` → `useAnalyzeImage()` → `useProviderChain(providerId)` — **the exact same hook, same cached availability/overrides/platform-settings/health data, same `resolveProviderChain` function** as the chat path above. No separate "vision" resolution path existed anywhere in the client. `withProviderAvailability(chain, () => runWithFallback(chain, (candidateId) => analyzeImage({..., providerId: candidateId})), ...)` → `analyzeImage.ts` builds a `ChatContentPart[]` message (`{type:'text',...}`, `{type:'image', imageUrl}`) → `streamChatCompletion` → `getChatProvider('openai').chat()` → the same `streamAiChat()`/`ai-chat` call the text path uses.

**The divergence is not in client-side provider resolution — both paths compute an identical chain from identical data.** The divergence is in what happens once the request reaches the `ai-chat` Edge Function.

### The actual root cause: the deployed `ai-chat` function was stale

`mcp__Supabase__get_edge_function` (project `uzshazetfkjkrdnxwjtl`, slug `ai-chat`) returned version 17, last updated well before this session, with source that **predates all multimodal support**:

- `ChatMessage.content: string` only — no `ChatContentPart[]` type, no `toAnthropicContent`/`toOpenAiContent`/`toGoogleParts` translators.
- `messages: body.messages` passed straight through to each provider's real API, unmodified.

The repository's own `supabase/functions/ai-chat/index.ts` (the version now deployed) has all of this multimodal handling already built — it was written in an earlier milestone (Multimodal Intelligence v1) but **never deployed**. Confirmed independently: `provider-availability`'s deployed source (v13) matches the repo byte-for-byte, so this isn't a blanket "nothing gets deployed" issue — it was specific to `ai-chat`.

**Concretely, what this meant for a real image-analysis request:** `analyzeImage.ts` sends `content: [{type:'image', imageUrl: 'https://...'}]` — the client's internal shape. The stale deployed function had no translator for this and forwarded that internal shape directly into OpenAI's request body as-is. OpenAI's real Chat Completions API expects `{type:'image_url', image_url:{url:...}}`, not `{type:'image', imageUrl:...}` — a request built from the untranslated shape does not match OpenAI's schema and would fail once it reached OpenAI's API, well after `OPENAI_API_KEY`'s presence had already been confirmed server-side (the key check happens before any content-shape handling, so this is not a "key missing" failure — the key genuinely is configured, which is exactly why normal chat succeeded and image analysis did not).

**This is deployment drift, not a routing or availability bug**, and it fully explains why the two paths behaved differently despite resolving an identical provider chain: the code that makes image content actually valid to send to OpenAI (or Anthropic/Google) existed in source control but was not running in production until this session redeployed it.

### Fix applied

Redeployed the current repository source of `supabase/functions/ai-chat/index.ts` verbatim (zero code changes needed — it was already correct) via `mcp__Supabase__deploy_edge_function`. Now version 18, live.

## C. Note path

`NoteDetailPage.tsx` had "Ask NOVA about this note," which called `createConversationWithQuery(\`I'd like to talk about a note called "${note.title}".\`)` — **the exact same bare-title-only seed pattern the P0 image fix in the prior milestone (PIP Stabilization & Intelligence Integration v1) already fixed for images.** The note's actual content never reached the model in that first turn.

Checked all four retrieval paths the task asked about:

- **Semantic retrieval into ongoing chat (`retrieveContext`/`SupabaseVectorStore`):** hardcoded to `match_document_chunks` only. No `note_embeddings`/`match_notes` call exists in this path. A note's content cannot reach an ongoing chat conversation's RAG context at all, regardless of relevance.
- **Universal Search:** notes ARE indexed and searchable there (`notesSearchProvider`, from the earlier "Notes Search Provider" milestone) — but Search is a separate surface from Chat; nothing in Chat calls `runUniversalSearch`.
- **Knowledge context (`retrieveGraphContext`):** extended in the prior milestone to accept `documentIds`/`assetIds`, but still has no `noteIds` param — `linkKnownConceptsToSource` does link a saved note's content into `knowledge_node_sources` with `source_type: 'note'`, so the data exists, but `retrieveGraphContext` never queries that source type, so it's unreachable from chat, structurally the same gap as documents/assets had before assets were fixed.
- **An explicit "Analyze this Note" operation:** did not exist. The closest thing was "Ask NOVA about this note," which (per the above) carried no real content.

**Conclusion:** Notes have no viable path to reliable analysis today. Per the task's own framing ("A Note is an intentional analysis target... should NOT depend solely on semantic retrieval accidentally finding it"), the correct fix is an explicit analysis action that carries real content directly — not a retrieval extension, which would still leave analysis dependent on the model's own retrieval/ranking behavior.

### A real constraint this discovery surfaced: URL length

The existing `createConversationWithQuery` mechanism seeds a new conversation by carrying the full query text through a URL query parameter (`?initialQuery=<encoded text>`) and having `ChatPage` read and send it once mounted. This works fine for a short typed question or the P0 image fix's bounded (title + 2-4 sentence description + short extracted text) seed message. It does **not** work safely for "substantial work" pasted into a Note — real browsers and servers commonly cap URL length in the low thousands of characters, and a note's content has no such bound by design. Reusing `createConversationWithQuery` verbatim for notes would have silently truncated or broken on exactly the case the task describes ("substantial work/content"). See Phase 3 below for how this was avoided.

## D. Provider capability matrix

| Provider | Text chat | Multimodal/image input | Fallback eligible | Availability (this deployment) | Entitlement restrictions |
|---|---|---|---|---|---|
| OpenAI (`openai`, model `gpt-5.1`) | ✅ wired, key configured | ✅ wired (`toOpenAiContent`), now actually deployed | ✅ | `OPENAI_API_KEY` configured — confirmed working (chat + embeddings) | None found in code |
| Anthropic (`anthropic`, model `claude-sonnet-5`) | ✅ wired | ✅ wired (`toAnthropicContent`), now actually deployed | ✅ | `ANTHROPIC_API_KEY` **not** configured in this deployment (per `registry.ts`'s own comment and `provider-availability`'s live response) | None found in code |
| Google (`google`, model `gemini-2.5-flash`) | ✅ wired | ✅ wired (`toGoogleParts`), now actually deployed, never live-tested | ✅ | `GOOGLE_API_KEY`/`GEMINI_API_KEY` not configured in this deployment | None found in code |

No provider-level "Pro-only" or plan-gated restriction on chat or image analysis exists anywhere in the traced code (quota/plan enforcement, where it exists elsewhere in this app, is a separate, unrelated system — not touched here and not implicated in either reported problem). Nothing in this matrix is exposed to the client beyond the existing boolean `{anthropic, openai, google}` availability shape `provider-availability` already returns — no key values, no model names, no routing internals.

## E. Root causes

**1. Confirmed root causes**
- The deployed `ai-chat` Edge Function was stale, missing all multimodal `ChatContentPart[]` handling that exists in source — this alone is sufficient to explain both the image-analysis failure and, per the trace above, is the most probable source of the exact "provider unavailable"-shaped failure reported (see the caveat below).
- Notes had no path that carried real content into an explicit analysis turn — "Ask NOVA about this note" seeded only a bare title, and no retrieval path (RAG, graph context, or otherwise) could reach a note's content from ongoing chat.
- No distinction between "chat-capable" and "vision-capable" existed in the provider registry or `resolveProviderChain` — every text-chat-eligible provider was, by construction, treated as automatically fine for image requests too, with no explicit declaration either way.

**2. Secondary defects**
- `createConversationWithQuery`'s URL-param seeding mechanism has an implicit length ceiling that would have silently broken a "substantial work" note if reused as-is for Notes analysis (see §C).

**3. Configuration issues**
- `ANTHROPIC_API_KEY`/`GOOGLE_API_KEY` are not configured secrets in this deployment. This is an operational/deployment-configuration fact, not a code defect — Anthropic and Google both remain fully wired and selectable; only OpenAI is presently usable end-to-end. No code change addresses or should address this.

**4. Deferred improvements** (explicitly out of scope for this milestone, listed here rather than silently done or silently ignored)
- Extending `retrieveContext`/`retrieveGraphContext` to also surface note content in *ongoing* chat conversations (symmetry with the P0 asset fix from the prior milestone) — the task's own framing prioritizes the explicit-analysis-action fix; retrieval symmetry is a reasonable follow-up, not required to resolve the reported symptom.
- A calibrated capability probe (e.g. an actual `HEAD`/dry-run request against each provider to verify live vision support) rather than the current static `supportsVision` declaration — not needed today since the declaration matches every registered provider's real capability exactly, but noted as the natural next step if a genuinely text-only provider is ever added.

**Explicitly not conflated with this milestone:** beta-invitation email delivery/configuration was out of scope by the task's own instruction and was not touched.
