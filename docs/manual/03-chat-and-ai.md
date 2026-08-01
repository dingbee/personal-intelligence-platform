# Chapter 3: Chat & AI

## Purpose

Chat is how you talk to NOVA directly — and unlike a generic AI chatbot, every answer is grounded in your own library, notes, conversation history, and (where relevant) the knowledge graph and your personal memory, rather than the model's general training.

## Feature Overview

- **Multi-conversation Chat page** — a full conversation list (pin, favorite, archive, rename, duplicate) alongside the active thread
- **Provider selection** — choose which AI provider (Anthropic, OpenAI, Google) powers a conversation, switchable per-conversation, not just globally
- **Provider availability detection** — the UI hides or flags providers that aren't currently configured/reachable, rather than letting you pick one that will fail
- **Provider fallback chain** — if your preferred provider fails mid-request, NOVA automatically retries with the next candidate in your configured chain, rather than just erroring out
- **RAG retrieval grounding** — every chat response is grounded in retrieved chunks from your actual documents, with the retrieved context visible via the Insight Drawer
- **Reader Chat Panel** — the same chat capability, docked inside a document's Reader view, scoped to that document
- **NOVA Insight Drawer** — a collapsible panel showing what context was used to answer (references, evidence level, reasoning trace), minimizable/maximizable so it doesn't have to dominate the screen
- **AI Health Dashboard** — observability into every AI request: latency, success/failure, which provider actually served each request, and fallback events
- **Memory** — NOVA remembers explicit facts you've told it, preferences it's learned, and relevant context from past conversations, and surfaces where that memory is actually influencing a given answer
- **Natural Language Knowledge Commands** — certain phrasings typed into Chat trigger a concrete action instead of a conversational answer; v1 recognizes "Create an executive briefing on X," which pulls Search, Confidence, Collections, Knowledge Graph, and Notes together to generate and save a grounded briefing (see Chapter 4)
- **AI Workspace Actions v1** — a shared router (behind both the executive briefing command above and the commands below) that recognizes a chat message as an action rather than a question; also recognizes "Save this," "Remember this," "Capture this," and "Add this to my notes," which save NOVA's most recent reply as a note the same way the per-message **Save to Notes** button does (see Chapter 2)

## Navigation

- **Chat** (sidebar) — the full multi-conversation experience
- Inside any document's Reader, the **Chat** tab gives you the same capability scoped to that document
- **Settings → AI Health** — the observability dashboard
- **Settings → Memory** — manage what NOVA remembers about you

## Real-World Examples

- Ask "what have I learned about customer experience?" in the main Chat — NOVA retrieves relevant chunks across your library and answers from them, not from general knowledge about customer experience.
- Open a spreadsheet in the Reader and ask "which region performs best?" in the docked Chat panel — the answer is grounded in the Spreadsheet Intelligence Analyst Layer's actual computed aggregates, not a guess from raw cell text.
- Your preferred provider has an outage mid-conversation — the fallback chain retries with your next configured provider automatically, and the AI Health Dashboard shows exactly when and why that happened.
- You type "Create an executive briefing on Revenue" into Chat — instead of a conversational answer, NOVA returns a completed briefing with a confidence percentage, and confirms it's been saved as a note.
- NOVA gives a reply worth keeping — you type "Remember this" instead of reaching for a button, and NOVA confirms it's been saved to Notes, linked back to this exact message.

## Typical Workflows

1. **Ask, then inspect**: send a question, then open the Insight Drawer to see exactly which documents/passages were used to answer it — useful when you want to verify, not just trust.
2. **Switch providers mid-project**: if a conversation is going in a direction better suited to a different model, switch its provider from the header without starting a new thread.
3. **Diagnose a bad answer**: if a response feels off, check AI Health for that request's latency/provider/fallback status before assuming the model itself was wrong.

## Best Practices

- Let a conversation's title auto-generate from its first message rather than renaming immediately — it's usually accurate and saves a step.
- Use the Reader-scoped Chat panel when your question is genuinely about one document; use the main Chat page for cross-document questions.
- Check the Insight Drawer before trusting a surprising answer — "no relevant context retrieved" is a meaningfully different situation than "retrieved context but answered incorrectly."

## Common Mistakes

- Assuming Chat has access to documents that haven't finished processing yet — an unprocessed document contributes nothing to retrieval.
- Confusing a provider being "unavailable" (not configured/reachable) with a provider being "not preferred" — the UI only hides truly unavailable providers, not ones you simply haven't chosen.
- Not noticing when a conversation's provider has silently become unavailable since it was set — the warning banner on the conversation header is the signal to switch.
- Assuming the executive briefing command understands loose phrasing — v1 only recognizes a specific pattern ("create/generate/write a(n) (executive) briefing on/about/for X"); anything else is answered as an ordinary chat message instead.
- Expecting "Save this" to save your own last message — it saves NOVA's most recent reply, the natural reading of "this" right after NOVA answers; to save your own message, use that message's own **Save to Notes** button instead.

## Related Features

- **Library & Reading** (Chapter 1) — Chat's retrieval is grounded in Library content
- **Notes** (Chapter 2) — conversations can become notes in one action
- **Knowledge Graph** (Chapter 4) — Chat is grounded partly through the knowledge graph (related concepts), and every message you send is scanned by the deterministic concept matcher
- **Universal Search** (Chapter 5) — conversations are themselves a searchable source, grouped and ranked as whole conversations rather than individual messages
- **Settings & Platform** (Chapter 8) — provider configuration and default provider live there

## AI Capabilities

- Every chat response is LLM-generated, but the retrieval that grounds it is a separate, deterministic step (embedding similarity search) — the model answers from what retrieval found, it doesn't freelance
- The reasoning trace and evidence scoring shown in the Insight Drawer are computed, not model-reported — they reflect what actually happened in the request, not the model's self-description of its own reasoning
- Fallback and provider routing logic is fully deterministic engineering, not AI-driven — reliability doesn't depend on a model being right
- Recognizing the executive briefing command itself is **not** AI — it's a deterministic phrase match, so no model call (and no risk of misclassifying a normal question as a command) is spent just deciding what you asked for; the briefing content that command produces is LLM-generated, same as Generate Briefing everywhere else
- Recognizing "Save this" and its variants is also **not** AI — same deterministic phrase match, and the save itself (note creation, linking, indexing) is entirely non-AI too; nothing about the Save to Notes path invokes a model

## Limitations

- Retrieval is currently semantic-only (embedding similarity) — there's no lexical/keyword fallback yet for queries an embedding model handles poorly (tracked in the Universal Search roadmap)
- Memory currently covers explicit facts, learned preferences, and conversation history — it does not yet compute a confidence score for how certain any given piece of memory is

## Future Roadmap

- More recognized workspace-action commands beyond "create an executive briefing on X" and "save this" ("compare this month's figures with last month," "summarize everything about Mtoni") rather than just today's two
- Recognizing loose variations in phrasing (today's command matching is a fixed pattern, not flexible intent understanding)
