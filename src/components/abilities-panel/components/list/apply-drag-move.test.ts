import { describe, expect, it } from 'vitest'

import { applyDragMove } from './apply-drag-move'

describe('applyDragMove', () => {
  it('reorders ids when no items are stable', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'c', new Set())
    expect(result).toEqual(['b', 'c', 'a'])
  })

  it('returns null when fromId is unknown', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'x', 'b', new Set())
    expect(result).toBeNull()
  })

  it('returns null when toId is unknown', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'x', new Set())
    expect(result).toBeNull()
  })

  it('returns null when the dragged item is itself stable', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'c', new Set(['a']))
    expect(result).toBeNull()
  })

  it('blocks moves to index 0 when the first item is stable', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'c', 'a', new Set(['a']))
    expect(result).toBeNull()
  })

  it('allows moves that do not displace the first stable item', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'b', 'c', new Set(['a']))
    expect(result).toEqual(['a', 'c', 'b'])
  })

  it('blocks moves past the last index when the last item is stable', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'c', new Set(['c']))
    expect(result).toBeNull()
  })

  it('allows moves that do not displace the last stable item', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'b', new Set(['c']))
    expect(result).toEqual(['b', 'a', 'c'])
  })

  it('does not constrain a stable item in the middle', () => {
    const result = applyDragMove(['a', 'b', 'c'], 'a', 'c', new Set(['b']))
    expect(result).toEqual(['b', 'c', 'a'])
  })

  it('allows reordering between two edge-stable items', () => {
    const result = applyDragMove(
      ['a', 'b', 'c', 'd'],
      'b',
      'c',
      new Set(['a', 'd']),
    )
    expect(result).toEqual(['a', 'c', 'b', 'd'])
  })

  it('blocks moves that would displace either edge stable in a both-ends-locked list', () => {
    const result = applyDragMove(
      ['a', 'b', 'c', 'd'],
      'b',
      'd',
      new Set(['a', 'd']),
    )
    expect(result).toBeNull()
  })
})
