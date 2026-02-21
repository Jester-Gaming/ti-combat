import type { UnitId } from './unit'

// Grouped dice for probability calculation: [hitValue, totalDiceCount]
export type DiceGroup = [number, number]

export type SourcedDiceGroup = [...DiceGroup, UnitId]
