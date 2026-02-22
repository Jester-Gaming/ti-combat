import type { DiceGroup, SourcedDiceGroup, UnitBaseType, UnitId } from '@/types'

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
    isEmpty: () => countPool(pool) === 0,
  }
}

function clonePool(pool: DicePool): DicePool {
  const result: DicePool = {}
  for (const [type, dice] of Object.entries(pool)) {
    if (dice) {
      result[type as UnitBaseType] = dice.map(
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
    isEmpty: () => countPool(data) === 0,

    addDiceCount: (
      count: number,
      strategyOrSourceOrUnit?: 'BEST' | 'WORST' | UnitBaseType | UnitId,
    ) => {
      if (countPool(data) === 0) return

      // Overload: (count, UnitId) — match by UnitId
      if (typeof strategyOrSourceOrUnit === 'number') {
        const target = strategyOrSourceOrUnit as UnitId
        for (const [, dice] of Object.entries(data)) {
          if (!dice) continue
          for (let i = 0; i < dice.length; i++) {
            if (dice[i][2] === target) {
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
        let bestType: UnitBaseType | undefined
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
              bestType = type as UnitBaseType
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

    addDiceGroup: (source: string, unit: UnitId, diceGroup: DiceGroup) => {
      const existing = data[source] ?? []
      data[source] = [...existing, [diceGroup[0], diceGroup[1], unit]]
    },
  } as DiceApi

  return api
}
