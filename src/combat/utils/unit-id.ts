import type { UnitId } from '@/types'

// Start above the ASCII range so that a UnitId, appearing as a single
// char in a packed string, never collides with separators (`!`, `|`) or
// JSON characters used in `getUnitsHash`.
let _nextCode = 0x80

/** Generate an array of N consecutive UnitIds (each a single-char string). */
export function nextUnitIds(count: number): UnitId[] {
  const result: UnitId[] = []
  for (let i = 0; i < count; i++) {
    result.push(String.fromCharCode(_nextCode++) as UnitId)
  }
  return result
}
