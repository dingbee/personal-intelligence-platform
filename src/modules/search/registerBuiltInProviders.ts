import { searchProviderRegistry } from '@/modules/search/registry'
import { documentSearchProvider } from '@/modules/search/providers/documentSearchProvider'
import { conversationSearchProvider } from '@/modules/search/providers/conversationSearchProvider'

// Side-effect module, imported once from app/App.tsx. Adding a future
// source type (notes, highlights, flashcards) means adding one more
// searchProviderRegistry.register() call here — modules/search/hooks/useSearch.ts
// and SearchPage never need to change.
searchProviderRegistry.register(documentSearchProvider)
searchProviderRegistry.register(conversationSearchProvider)
