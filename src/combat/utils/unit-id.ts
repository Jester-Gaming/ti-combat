import type { UnitId } from '@/types'

let _nextId = 0

export function nextUnitId(): UnitId {
  return _nextId++ as UnitId
}

/** Generate an array of N consecutive UnitIds */
export function nextUnitIds(count: number): UnitId[] {
  const result: UnitId[] = []
  for (let i = 0; i < count; i++) {
    result.push(_nextId++ as UnitId)
  }
  return result
}
