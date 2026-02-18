import { isDraft, original } from 'immer'

import type { DiceGroup, SourcedDiceGroup, Unit, UnitType } from '@/types'

import type { DiceApi, DicePool, DiceReadApi } from '../types'

function countPool(pool: DicePool): number {
  let total = 0
  for (const units of Object.values(pool)) {
    if (units) total += units.length
  }
  return total
}

export function buildDiceReadApi(pool: DicePool): DiceReadApi {
  return {
    getAll: () => pool,
    get: (source: string) => pool[source],
    count: () => countPool(pool),
    isEmpty: () => countPool(pool) === 0,
  }
}

function clonePool(pool: DicePool): DicePool {
  const result: DicePool = {}
  for (const [type, dice] of Object.entries(pool)) {
    if (dice) {
      result[type as UnitType] = dice.map(
        d => [d[0], d[1], d[2]] as SourcedDiceGroup,
      )
    }
  }
  return result
}

export function buildDiceApi(pool: DicePool): DiceApi {
  const data = clonePool(pool)

  const api: DiceApi = {
    getAll: () => data,
    get: (source: string) => data[source],
    count: () => countPool(data),
    isEmpty: () => countPool(data) === 0,

    modifyHitValue: (amount: number, filterOrSourceOrUnit?: unknown) => {
      // Overload: (amount, Unit) — match by reference equality
      if (
        typeof filterOrSourceOrUnit === 'object' &&
        filterOrSourceOrUnit !== null
      ) {
        // Unwrap Immer draft so the reference matches the original
        // stored in SourcedDiceGroup by collectDice
        const targetUnit = isDraft(filterOrSourceOrUnit)
          ? original(filterOrSourceOrUnit)
          : filterOrSourceOrUnit
        for (const [, dice] of Object.entries(data)) {
          if (!dice) continue
          for (let i = 0; i < dice.length; i++) {
            if (dice[i][2] === targetUnit) {
              dice[i] = [
                Math.max(1, dice[i][0] + amount),
                dice[i][1],
                dice[i][2],
              ]
              return
            }
          }
        }
        return
      }

      const predicate =
        filterOrSourceOrUnit === undefined
          ? () => true
          : typeof filterOrSourceOrUnit === 'function'
            ? (source: UnitType) =>
                (filterOrSourceOrUnit as (s: UnitType) => boolean)(source)
            : (source: UnitType) => source === filterOrSourceOrUnit

      for (const [type, dice] of Object.entries(data)) {
        if (!dice) continue
        if (!predicate(type as UnitType)) continue
        for (let i = 0; i < dice.length; i++) {
          dice[i] = [Math.max(1, dice[i][0] + amount), dice[i][1], dice[i][2]]
        }
      }
    },

    addDiceCount: (
      count: number,
      strategyOrSourceOrUnit?: 'BEST' | 'WORST' | UnitType | object,
    ) => {
      if (countPool(data) === 0) return

      // Overload: (count, Unit) — match by reference equality
      if (
        typeof strategyOrSourceOrUnit === 'object' &&
        strategyOrSourceOrUnit !== null
      ) {
        const targetUnit = isDraft(strategyOrSourceOrUnit)
          ? original(strategyOrSourceOrUnit)
          : strategyOrSourceOrUnit
        for (const [, dice] of Object.entries(data)) {
          if (!dice) continue
          for (let i = 0; i < dice.length; i++) {
            if (dice[i][2] === targetUnit) {
              dice[i] = [dice[i][0], dice[i][1] + count, dice[i][2]]
              return
            }
          }
        }
        return
      }

      if (
        strategyOrSourceOrUnit === undefined ||
        strategyOrSourceOrUnit === 'BEST' ||
        strategyOrSourceOrUnit === 'WORST'
      ) {
        const isBest =
          strategyOrSourceOrUnit === undefined ||
          strategyOrSourceOrUnit === 'BEST'
        let bestType: UnitType | undefined
        let bestIndex = -1
        let bestHitValue = isBest ? Infinity : -Infinity

        for (const [type, dice] of Object.entries(data)) {
          if (!dice) continue
          for (let i = 0; i < dice.length; i++) {
            const hitValue = dice[i][0]
            const better = isBest
              ? hitValue < bestHitValue
              : hitValue > bestHitValue
            if (better) {
              bestHitValue = hitValue
              bestType = type as UnitType
              bestIndex = i
            }
          }
        }

        if (bestType !== undefined && bestIndex >= 0) {
          const dice = data[bestType]!
          dice[bestIndex] = [
            dice[bestIndex][0],
            dice[bestIndex][1] + count,
            dice[bestIndex][2],
          ]
        }
      } else {
        const dice = data[strategyOrSourceOrUnit]
        if (!dice || dice.length === 0) return
        dice[0] = [dice[0][0], dice[0][1] + count, dice[0][2]]
      }
    },

    addDiceGroup: (source: string, unit: Unit, diceGroup: DiceGroup) => {
      const existing = data[source] ?? []
      const resolvedUnit = isDraft(unit) ? original(unit)! : unit
      data[source] = [...existing, [diceGroup[0], diceGroup[1], resolvedUnit]]
    },
  } as DiceApi

  return api
}
