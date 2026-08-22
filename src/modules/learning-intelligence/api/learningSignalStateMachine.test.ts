import { describe, expect, it } from 'vitest'
import { canRevokeLearningSignal, isTerminalLearningSignalStatus, isTrustedForAdaptation, isValidLearningSignalTransition } from '@/modules/learning-intelligence/api/learningSignalStateMachine'

describe('learningSignalStateMachine', () => {
  it('proposed can become active, contested, or revoked', () => {
    expect(isValidLearningSignalTransition('proposed', 'active')).toBe(true)
    expect(isValidLearningSignalTransition('proposed', 'contested')).toBe(true)
    expect(isValidLearningSignalTransition('proposed', 'revoked')).toBe(true)
  })

  it('active can become contested or revoked, never back to proposed', () => {
    expect(isValidLearningSignalTransition('active', 'contested')).toBe(true)
    expect(isValidLearningSignalTransition('active', 'revoked')).toBe(true)
    expect(isValidLearningSignalTransition('active', 'proposed')).toBe(false)
  })

  it('contested can only become revoked', () => {
    expect(isValidLearningSignalTransition('contested', 'revoked')).toBe(true)
    expect(isValidLearningSignalTransition('contested', 'active')).toBe(false)
    expect(isValidLearningSignalTransition('contested', 'proposed')).toBe(false)
  })

  it('revoked is terminal — no valid transitions out of it', () => {
    expect(isValidLearningSignalTransition('revoked', 'proposed')).toBe(false)
    expect(isValidLearningSignalTransition('revoked', 'active')).toBe(false)
    expect(isValidLearningSignalTransition('revoked', 'contested')).toBe(false)
    expect(isTerminalLearningSignalStatus('revoked')).toBe(true)
  })

  it('only revoked is terminal', () => {
    expect(isTerminalLearningSignalStatus('proposed')).toBe(false)
    expect(isTerminalLearningSignalStatus('active')).toBe(false)
    expect(isTerminalLearningSignalStatus('contested')).toBe(false)
  })

  it('canRevokeLearningSignal is true for every status except revoked', () => {
    expect(canRevokeLearningSignal('proposed')).toBe(true)
    expect(canRevokeLearningSignal('active')).toBe(true)
    expect(canRevokeLearningSignal('contested')).toBe(true)
    expect(canRevokeLearningSignal('revoked')).toBe(false)
  })

  it('only an active signal is trusted for adaptation — proposed/contested/revoked never influence future intelligence', () => {
    expect(isTrustedForAdaptation('active')).toBe(true)
    expect(isTrustedForAdaptation('proposed')).toBe(false)
    expect(isTrustedForAdaptation('contested')).toBe(false)
    expect(isTrustedForAdaptation('revoked')).toBe(false)
  })
})
