import { describe, expect, it } from 'vitest'
import { extractLexicalSearchTerms } from '@/modules/ai/orchestration/extractLexicalSearchTerms'

describe('extractLexicalSearchTerms', () => {
  it('extracts the rare ALL-CAPS entity from the exact ARRIYIA diagnostic question', () => {
    expect(extractLexicalSearchTerms('What has been mentioned about ARRIYIA in this article?')).toEqual(['ARRIYIA'])
  })

  it('extracts ALL-CAPS entities regardless of position in the sentence', () => {
    expect(extractLexicalSearchTerms('ARRIYIA appears where in the document?')).toContain('ARRIYIA')
  })

  it('extracts a Title-Case proper noun that is not the first word', () => {
    expect(extractLexicalSearchTerms('What does the article say about Zephyros?')).toContain('Zephyros')
  })

  it('does not extract the leading capitalized word of a question as an entity', () => {
    const terms = extractLexicalSearchTerms('What does the document say about pricing?')
    expect(terms).toEqual([])
  })

  it('does not extract short or common capitalized stopwords', () => {
    expect(extractLexicalSearchTerms('Is this positive or negative?')).toEqual([])
  })

  it('extracts a quoted phrase verbatim', () => {
    expect(extractLexicalSearchTerms('What does it say about "the pricing model"?')).toContain('the pricing model')
  })

  it('returns no terms for a fully lowercase, entity-free query', () => {
    expect(extractLexicalSearchTerms('summarize this document in five key points')).toEqual([])
  })

  it('deduplicates a term mentioned more than once in the same query', () => {
    expect(extractLexicalSearchTerms('Is ARRIYIA discussed positively? Does ARRIYIA appear elsewhere?')).toEqual(['ARRIYIA'])
  })

  it('does not extract a nonexistent-entity placeholder any differently — same extraction rules for a negative-retrieval test', () => {
    expect(extractLexicalSearchTerms('Does the document mention ZYNTHOR?')).toEqual(['ZYNTHOR'])
  })
})
