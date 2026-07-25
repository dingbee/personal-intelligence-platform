# AI Providers

Pluggable adapters for model providers (OpenAI, Anthropic, Google Gemini).
Each provider implements a shared `ChatProvider` / `EmbeddingProvider`
interface so `orchestration/` can swap providers without touching callers.

Not implemented yet — this module is scaffolded for a later milestone
(AI chat with RAG).
