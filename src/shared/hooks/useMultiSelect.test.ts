import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMultiSelect } from '@/shared/hooks/useMultiSelect'

describe('useMultiSelect', () => {
  it('starts inactive with nothing selected', () => {
    const { result } = renderHook(() => useMultiSelect())
    expect(result.current.active).toBe(false)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('enable() activates selection mode', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => result.current.enable())
    expect(result.current.active).toBe(true)
  })

  it('toggle() adds then removes an id', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => result.current.toggle('a'))
    expect(result.current.selectedIds.has('a')).toBe(true)
    act(() => result.current.toggle('a'))
    expect(result.current.selectedIds.has('a')).toBe(false)
  })

  it('toggle() tracks multiple ids independently', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })
    expect(result.current.selectedIds).toEqual(new Set(['a', 'b']))
  })

  it('clear() empties the selection without leaving selection mode', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => {
      result.current.enable()
      result.current.toggle('a')
      result.current.clear()
    })
    expect(result.current.active).toBe(true)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('disable() exits selection mode and clears the selection', () => {
    const { result } = renderHook(() => useMultiSelect())
    act(() => {
      result.current.enable()
      result.current.toggle('a')
      result.current.disable()
    })
    expect(result.current.active).toBe(false)
    expect(result.current.selectedIds.size).toBe(0)
  })
})
