import { describe, expect, it } from 'vitest'
import { generateExecutiveInsights } from '@/modules/intelligence/dashboard/dashboardInsights'
import type { Cluster } from '@/modules/knowledge/intelligence/conceptClusters'

function baseInput() {
  return {
    clusters: [] as Cluster[],
    totalConceptCount: 0,
    unreviewedHighlightCount: 0,
    sampledHighlightCount: 0,
    documentsWithoutCollectionCount: 0,
    totalDocumentCount: 0,
    memoryContents: [] as string[],
    recentConversationTitles: [] as string[],
    previousConversationTitles: [] as string[],
  }
}

describe('generateExecutiveInsights', () => {
  it('returns nothing when there is no data to report on', () => {
    expect(generateExecutiveInsights(baseInput())).toEqual([])
  })

  it('surfaces a knowledge insight for the largest cluster, with evidence', () => {
    const clusters: Cluster[] = [{ id: 'a', label: 'Machine Learning', nodeIds: ['a', 'b', 'c'], size: 3, density: 1 }]
    const insights = generateExecutiveInsights({ ...baseInput(), clusters, totalConceptCount: 10 })
    const knowledge = insights.find((i) => i.category === 'knowledge')
    expect(knowledge?.message).toContain('Machine Learning')
    expect(knowledge?.evidence).toContain('3 connected concepts')
    expect(knowledge?.evidence).toContain('10 total')
  })

  it('picks the largest cluster when multiple exist', () => {
    const clusters: Cluster[] = [
      { id: 'a', label: 'Small', nodeIds: ['a', 'b'], size: 2, density: 1 },
      { id: 'c', label: 'Big', nodeIds: ['c', 'd', 'e'], size: 3, density: 1 },
    ]
    const insights = generateExecutiveInsights({ ...baseInput(), clusters, totalConceptCount: 5 })
    expect(insights.find((i) => i.category === 'knowledge')?.message).toContain('Big')
  })

  it('surfaces a learning insight for unreviewed highlights, with evidence', () => {
    const insights = generateExecutiveInsights({ ...baseInput(), unreviewedHighlightCount: 4, sampledHighlightCount: 20 })
    const learning = insights.find((i) => i.category === 'learning')
    expect(learning?.message).toContain('4')
    expect(learning?.evidence).toContain('20')
  })

  it('omits the learning insight when everything has been reviewed', () => {
    const insights = generateExecutiveInsights({ ...baseInput(), unreviewedHighlightCount: 0, sampledHighlightCount: 20 })
    expect(insights.find((i) => i.category === 'learning')).toBeUndefined()
  })

  it('surfaces an organization insight for documents without a collection', () => {
    const insights = generateExecutiveInsights({ ...baseInput(), documentsWithoutCollectionCount: 3, totalDocumentCount: 8 })
    const organization = insights.find((i) => i.category === 'organization')
    expect(organization?.message).toContain('3')
    expect(organization?.evidence).toContain('3 of 8')
  })

  it('surfaces a memory insight for the most frequent word in stored memories', () => {
    const insights = generateExecutiveInsights({
      ...baseInput(),
      memoryContents: ['User prefers pricing discussions', 'User asked about pricing again', 'User mentioned pricing strategy'],
    })
    expect(insights.find((i) => i.category === 'memory')?.message).toContain('pricing')
  })

  it('omits the memory insight when no word repeats often enough', () => {
    const insights = generateExecutiveInsights({ ...baseInput(), memoryContents: ['User likes cats.'] })
    expect(insights.find((i) => i.category === 'memory')).toBeUndefined()
  })

  it('surfaces a research insight when the recent topic differs from the previous one', () => {
    const insights = generateExecutiveInsights({
      ...baseInput(),
      recentConversationTitles: ['Automation basics', 'Automation tools', 'Automation workflow'],
      previousConversationTitles: ['Marketing basics', 'Marketing tools', 'Marketing plans'],
    })
    const research = insights.find((i) => i.category === 'research')
    expect(research?.message).toContain('automation')
    expect(research?.evidence).toContain('marketing')
  })

  it('omits the research insight when the topic has not changed', () => {
    const insights = generateExecutiveInsights({
      ...baseInput(),
      recentConversationTitles: ['Automation basics', 'Automation tools', 'Automation workflow'],
      previousConversationTitles: ['Automation planning', 'Automation review', 'Automation roadmap'],
    })
    expect(insights.find((i) => i.category === 'research')).toBeUndefined()
  })

  it('produces an insight for every category when all data is present', () => {
    const insights = generateExecutiveInsights({
      clusters: [{ id: 'a', label: 'Hospitality', nodeIds: ['a', 'b'], size: 2, density: 1 }],
      totalConceptCount: 4,
      unreviewedHighlightCount: 2,
      sampledHighlightCount: 10,
      documentsWithoutCollectionCount: 1,
      totalDocumentCount: 3,
      memoryContents: ['User prefers pricing', 'User discussed pricing', 'User asked about pricing'],
      recentConversationTitles: ['Automation trends', 'Automation news', 'Automation updates'],
      previousConversationTitles: ['Marketing trends', 'Marketing news', 'Marketing updates'],
    })
    expect(insights.map((i) => i.category).sort()).toEqual(['knowledge', 'learning', 'memory', 'organization', 'research'])
  })
})
