import { describe, expect, it } from 'vitest'
import { buildDecisionFramework, extractDecisionOptions } from '@/modules/intelligence/decision/decisionFrameworkBuilder'

describe('extractDecisionOptions', () => {
  it('extracts two options from an "A vs B" message', () => {
    expect(extractDecisionOptions('Deep Work vs Atomic Habits')).toEqual([{ label: 'Deep Work' }, { label: 'Atomic Habits' }])
  })

  it('extracts two options from an "A versus B" message', () => {
    expect(extractDecisionOptions('Deep Work versus Atomic Habits')).toEqual([{ label: 'Deep Work' }, { label: 'Atomic Habits' }])
  })

  it('extracts two options from an "A or B" message', () => {
    expect(extractDecisionOptions('Should I read Deep Work or Atomic Habits?')).toEqual([
      { label: 'read Deep Work' },
      { label: 'Atomic Habits' },
    ])
  })

  it('strips a leading "Should I" phrase before splitting', () => {
    const options = extractDecisionOptions('Should I switch to Claude or stay with GPT?')
    expect(options).toEqual([{ label: 'switch to Claude' }, { label: 'stay with GPT' }])
  })

  it('returns an empty array when no comparable options can be found', () => {
    expect(extractDecisionOptions('Should I switch to a new provider?')).toEqual([])
  })

  it('returns an empty array for an unrelated message', () => {
    expect(extractDecisionOptions('What is a knowledge graph?')).toEqual([])
  })

  it('prefers "vs" over "or" when both could technically match', () => {
    expect(extractDecisionOptions('Plan A vs Plan B or Plan C')).toEqual([{ label: 'Plan A' }, { label: 'Plan B or Plan C' }])
  })
})

describe('buildDecisionFramework', () => {
  it('builds a framework when two options are found', () => {
    const framework = buildDecisionFramework('Deep Work vs Atomic Habits')
    expect(framework?.options).toEqual([{ label: 'Deep Work' }, { label: 'Atomic Habits' }])
  })

  it('returns null when fewer than two options can be extracted', () => {
    expect(buildDecisionFramework('Should I do this?')).toBeNull()
  })

  it('never fabricates pros, cons, or risks', () => {
    const framework = buildDecisionFramework('Deep Work vs Atomic Habits')
    expect(framework?.pros).toEqual([])
    expect(framework?.cons).toEqual([])
    expect(framework?.risks).toEqual([])
  })

  it('never fabricates a recommendation and always reports low confidence', () => {
    const framework = buildDecisionFramework('Deep Work vs Atomic Habits')
    expect(framework?.recommendation).toBeNull()
    expect(framework?.confidence).toBe('low')
  })

  it('is a pure function of its input', () => {
    expect(buildDecisionFramework('Deep Work vs Atomic Habits')).toEqual(buildDecisionFramework('Deep Work vs Atomic Habits'))
  })
})
