import { searchProviderRegistry } from '@/modules/search/registry'
import { documentSearchProvider } from '@/modules/search/providers/documentSearchProvider'
import { conversationSearchProvider } from '@/modules/search/providers/conversationSearchProvider'
import { notesSearchProvider } from '@/modules/search/providers/notesSearchProvider'
import { assetSearchProvider } from '@/modules/search/providers/assetSearchProvider'

// Side-effect module, imported once from app/App.tsx. Adding a future
// source type (notes, highlights, flashcards) means adding one more
// searchProviderRegistry.register() call here — modules/search/hooks/useSearch.ts
// and SearchPage never need to change.
searchProviderRegistry.register(documentSearchProvider)
searchProviderRegistry.register(conversationSearchProvider)
searchProviderRegistry.register(notesSearchProvider)
searchProviderRegistry.register(assetSearchProvider)
