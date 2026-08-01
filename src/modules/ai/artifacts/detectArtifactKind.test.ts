import { describe, expect, it } from 'vitest'
import { detectArtifactKind } from '@/modules/ai/artifacts/detectArtifactKind'

describe('detectArtifactKind', () => {
  it('defaults to note for plain prose', () => {
    expect(detectArtifactKind('Thanks, that makes sense — I will follow up next week.')).toBe('note')
  })

  it('returns note for empty content', () => {
    expect(detectArtifactKind('   ')).toBe('note')
  })

  it('detects formula from a Formula: line', () => {
    const content = [
      'Hotel Occupancy Formula',
      '',
      'Inputs:',
      'Available Rooms',
      'Occupied Rooms',
      '',
      'Formula:',
      'Occupied / Available',
      '',
      'Category:',
      'Hospitality Analytics',
    ].join('\n')
    expect(detectArtifactKind(content)).toBe('formula')
  })

  it('detects formula from a spreadsheet-style cell reference', () => {
    expect(detectArtifactKind('Set cell D2 to =B2*C2 to compute the extended price.')).toBe('formula')
  })

  it('detects spreadsheet from a markdown table', () => {
    const content = ['| Month | Revenue |', '| --- | --- |', '| Jan | 1200 |', '| Feb | 1500 |'].join('\n')
    expect(detectArtifactKind(content)).toBe('spreadsheet')
  })

  it('detects chart from an explicit chart-type mention', () => {
    expect(detectArtifactKind('Here is a line chart of monthly revenue growth.')).toBe('chart')
  })

  it('prefers chart over spreadsheet when both a table and an explicit chart mention are present', () => {
    const content = ['Line Chart', '| Month | Revenue |', '| --- | --- |', '| Jan | 1200 |'].join('\n')
    expect(detectArtifactKind(content)).toBe('chart')
  })

  it('detects knowledge_card from a short insight with a confidence marker', () => {
    const content = [
      'Insight: Peak booking period is July-August',
      'Confidence: 89%',
      'Sources: 14 documents',
      'Related: Revenue Strategy',
    ].join('\n')
    expect(detectArtifactKind(content)).toBe('knowledge_card')
  })

  it('does not detect knowledge_card for a long response that happens to mention confidence', () => {
    const long = `Confidence: 89%. ${'This is a long explanation of the underlying methodology. '.repeat(20)}`
    expect(detectArtifactKind(long)).not.toBe('knowledge_card')
  })

  it('detects template from an explicit checklist framing', () => {
    expect(detectArtifactKind('Onboarding Checklist\n1. Collect documents\n2. Verify identity\n3. Issue keycard')).toBe('template')
  })

  it('detects report from multiple section headings in a long response', () => {
    const sections = ['Executive Summary', 'Market Analysis', 'Recommendation'].map(
      (heading) => `## ${heading}\n${'Supporting detail for this section. '.repeat(15)}`,
    )
    expect(detectArtifactKind(sections.join('\n\n'))).toBe('report')
  })

  it('does not detect report from a short response with two headings', () => {
    expect(detectArtifactKind('## A\nshort\n\n## B\nshort')).toBe('note')
  })
})
