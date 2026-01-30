import type { DiceData, UnitType } from '@/types'

import type { DiceApi, DicePool, DiceReadApi } from './types'

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
    get: (source: UnitType) => pool[source],
    count: () => countPool(pool),
    isEmpty: () => countPool(pool) === 0,
  }
}

/** Deep-clone a DicePool so mutations don't affect the original */
function clonePool(pool: DicePool): DicePool {
  const result: DicePool = {}
  for (const [type, units] of Object.entries(pool)) {
    if (units) {
      result[type as UnitType] = units.map(d => [...d] as DiceData)
    }
  }
  return result
}

export function buildDiceApi(pool: DicePool): DiceApi {
  const data = clonePool(pool)

  const api: DiceApi = {
    getAll: () => data,
    get: (source: UnitType) => data[source],
    count: () => countPool(data),
    isEmpty: () => countPool(data) === 0,

    modifyHitValue: (
      amount: number,
      filterOrSource?: UnitType | ((source: UnitType) => boolean),
      unitIndex?: number,
    ) => {
      // Overload: (amount, source, unitIndex) — target single unit
      if (typeof filterOrSource === 'string' && unitIndex !== undefined) {
        const units = data[filterOrSource]
        if (units && units[unitIndex]) {
          units[unitIndex] = [
            Math.max(1, units[unitIndex][0] + amount),
            units[unitIndex][1],
          ]
        }
        return
      }

      const predicate =
        filterOrSource === undefined
          ? () => true
          : typeof filterOrSource === 'function'
            ? (source: UnitType) => filterOrSource(source)
            : (source: UnitType) => source === filterOrSource

      for (const [type, units] of Object.entries(data)) {
        if (!units) continue
        if (!predicate(type as UnitType)) continue
        for (let i = 0; i < units.length; i++) {
          units[i] = [Math.max(1, units[i][0] + amount), units[i][1]]
        }
      }
    },

    addDice: (
      count: number,
      strategyOrSource?: 'BEST' | 'WORST' | UnitType,
    ) => {
      if (countPool(data) === 0) return

      if (
        strategyOrSource === undefined ||
        strategyOrSource === 'BEST' ||
        strategyOrSource === 'WORST'
      ) {
        // Find the unit entry with best/worst hit value across entire pool
        const isBest =
          strategyOrSource === undefined || strategyOrSource === 'BEST'
        let bestType: UnitType | undefined
        let bestIndex = -1
        let bestHitValue = isBest ? Infinity : -Infinity

        for (const [type, units] of Object.entries(data)) {
          if (!units) continue
          for (let i = 0; i < units.length; i++) {
            const hitValue = units[i][0]
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
          const units = data[bestType]!
          units[bestIndex] = [units[bestIndex][0], units[bestIndex][1] + count]
        }
      } else {
        // Add to specific source type — add to first unit of that type
        const units = data[strategyOrSource]
        if (!units || units.length === 0) return
        units[0] = [units[0][0], units[0][1] + count]
      }
    },
  } as DiceApi

  return api
}
