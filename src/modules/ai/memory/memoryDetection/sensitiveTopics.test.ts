import { describe, expect, it } from 'vitest'
import { containsSensitiveTopic } from '@/modules/ai/memory/memoryDetection/sensitiveTopics'

describe('containsSensitiveTopic', () => {
  it('flags health/medical content', () => {
    expect(containsSensitiveTopic('I take medication for my anxiety disorder.')).toBe(true)
  })

  it('flags political content', () => {
    expect(containsSensitiveTopic('I always vote for the Republican candidate.')).toBe(true)
  })

  it('flags religious content', () => {
    expect(containsSensitiveTopic('I am Christian and go to church every Sunday.')).toBe(true)
  })

  it('flags other private/sensitive categories', () => {
    expect(containsSensitiveTopic('My social security number is 123-45-6789.')).toBe(true)
  })

  it('does not flag an ordinary preference statement', () => {
    expect(containsSensitiveTopic('I prefer dark mode interfaces.')).toBe(false)
  })

  it('does not flag an ordinary profile statement', () => {
    expect(containsSensitiveTopic('My daughter is named Elyana.')).toBe(false)
  })
})
