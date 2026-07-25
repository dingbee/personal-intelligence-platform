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
    { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'chat', status: 'planned' },
    { id: 'openai', label: 'OpenAI (GPT)', kind: 'chat', status: 'planned' },
    { id: 'google', label: 'Google (Gemini)', kind: 'chat', status: 'planned' },
    { id: 'ollama', label: 'Ollama (local)', kind: 'chat', status: 'planned' },
    { id: 'openrouter', label: 'OpenRouter', kind: 'chat', status: 'planned' },
    { id: 'azure-openai', label: 'Azure OpenAI', kind: 'chat', status: 'planned' },
    { id: 'placeholder-embeddings', label: 'Placeholder (hash-based)', kind: 'embedding', status: 'available' },
  ],
})
