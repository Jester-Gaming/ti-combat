import type { Unit } from './unit'

// Grouped dice for probability calculation: [hitValue, totalDiceCount]
export type DiceGroup = [number, number]

export type SourcedDiceGroup = [...DiceGroup, Unit]
