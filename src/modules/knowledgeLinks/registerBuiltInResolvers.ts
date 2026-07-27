import { linkResolverRegistry } from '@/modules/knowledgeLinks/registry'
import { noteLinkResolver } from '@/modules/knowledgeLinks/resolvers/noteLinkResolver'
import { documentLinkResolver } from '@/modules/knowledgeLinks/resolvers/documentLinkResolver'
import { highlightLinkResolver } from '@/modules/knowledgeLinks/resolvers/highlightLinkResolver'
import { conversationLinkResolver } from '@/modules/knowledgeLinks/resolvers/conversationLinkResolver'
import { flashcardLinkResolver } from '@/modules/knowledgeLinks/resolvers/flashcardLinkResolver'

// Side-effect module, imported once from app/App.tsx — mirrors
// modules/search/registerBuiltInProviders. A future entity type adds one
// more linkResolverRegistry.register() call here.
linkResolverRegistry.register(noteLinkResolver)
linkResolverRegistry.register(documentLinkResolver)
linkResolverRegistry.register(highlightLinkResolver)
linkResolverRegistry.register(conversationLinkResolver)
linkResolverRegistry.register(flashcardLinkResolver)
