import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/**
 * The built-in "core" module. Exists as a reference implementation for
 * future domain modules (Education, Writing, Research, News, Business, ...):
 * it contributes generic capabilities and provider descriptors through
 * exactly the same registerPlatformModule() call a domain module would use.
 * A domain module might add "Lesson Plan" or "Bias Detection" alongside
 * these without ever touching this file or the registries' implementation.
 *
 * Imported once, for its side effect, from app/App.tsx.
 */
registerPlatformModule({
  id: 'core',
  name: 'Core',
  capabilities: [
    { id: 'chat', label: 'Chat', description: 'Ask questions grounded in your own documents via RAG.' },
    { id: 'summarize', label: 'Summarize', description: 'Condense a document, chapter, or note into key points.' },
    { id: 'explain', label: 'Explain', description: 'Break down a difficult passage or concept in plain language.' },
    { id: 'quiz', label: 'Quiz', description: 'Generate questions to test understanding of the content.' },
    { id: 'flashcards', label: 'Flashcards', description: 'Turn content into spaced-repetition-ready flashcards.' },
    { id: 'timeline', label: 'Timeline', description: 'Extract events or developments in chronological order.' },
    { id: 'compare', label: 'Compare', description: 'Highlight similarities and differences across documents.' },
    { id: 'extract', label: 'Extract', description: 'Pull out specific facts, quotes, or data points.' },
    { id: 'translate', label: 'Translate', description: 'Translate content into another language.' },
    { id: 'rewrite', label: 'Rewrite', description: 'Rephrase content for tone, clarity, or length.' },
    { id: 'outline', label: 'Outline', description: 'Produce a structural outline of the content.' },
    { id: 'mind-map', label: 'Mind Map', description: 'Map out concepts and how they relate to each other.' },
  ],
  providers: [
    // "available" means the code path is real (edge function + client adapter wired up),
    // not that a key is necessarily configured — see supabase/functions/ai-chat.
    { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'chat', status: 'available' },
    { id: 'openai', label: 'OpenAI (GPT)', kind: 'chat', status: 'available' },
    { id: 'google', label: 'Google (Gemini)', kind: 'chat', status: 'available' },
    { id: 'ollama', label: 'Ollama (local)', kind: 'chat', status: 'planned' },
    { id: 'openrouter', label: 'OpenRouter', kind: 'chat', status: 'planned' },
    { id: 'azure-openai', label: 'Azure OpenAI', kind: 'chat', status: 'planned' },
    { id: 'openai-embeddings', label: 'OpenAI (text-embedding-3-small)', kind: 'embedding', status: 'available' },
  ],
  prompts: [
    {
      id: 'rag-chat@1.0',
      capabilityId: 'chat',
      version: '1.0',
      active: true,
      template:
        "You are the user's personal knowledge assistant. Answer using ONLY the context below from " +
        'the user\'s own documents. If the context does not contain the answer, say so plainly instead ' +
        "of guessing from general knowledge.\n\nContext:\n{{context}}",
    },
    {
      id: 'summarize@1.0',
      capabilityId: 'summarize',
      version: '1.0',
      active: true,
      template:
        'Summarize the following content clearly and concisely, in prose (not a list unless the ' +
        'content itself is a list), preserving the key points a reader would need to remember. ' +
        'Respond with ONLY the summary — no preamble.\n\nContent:\n{{content}}',
    },
    {
      id: 'flashcards@1.0',
      capabilityId: 'flashcards',
      version: '1.0',
      active: true,
      template:
        'Generate 5 to 10 flashcards from the following content, covering its most important facts ' +
        'and concepts. Respond with ONLY a JSON array of objects shaped like ' +
        '{"front": "question or term", "back": "answer or definition"} — no markdown code fences, ' +
        'no other text.\n\nContent:\n{{content}}',
    },
  ],
})
