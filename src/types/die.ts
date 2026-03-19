import type { UnitId } from './unit'

// Dice spec: [hitValue, baseDice] or [hitValue, baseDice, bonusDice]
export type DiceGroup = [number, number] | [number, number, number]

// Runtime dice pool entry: [hitValue, baseDice, bonusDice, UnitId]
export type SourcedDiceGroup = [number, number, number, UnitId]
