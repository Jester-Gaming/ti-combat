import type { DieValue, UnitType } from '@/types'

import type { DiceApi, DiceReadApi } from './types'

export function buildDiceReadApi(dice: readonly DieValue[]): DiceReadApi {
  return {
    getAll: () => dice,
    get: (source: UnitType) => dice.find(d => d[2] === source),
    count: () => dice.length,
    isEmpty: () => dice.length === 0,
  }
}

export function buildDiceApi(dice: DieValue[]): DiceApi {
  const data = dice.map(d => [...d] as DieValue)

  const api: DiceApi = {
    getAll: () => data,
    get: (source: UnitType) => data.find(d => d[2] === source),
    count: () => data.length,
    isEmpty: () => data.length === 0,

    modifyHitValue: (
      amount: number,
      filterOrSource?: UnitType | ((source: UnitType) => boolean),
    ) => {
      const predicate =
        filterOrSource === undefined
          ? () => true
          : typeof filterOrSource === 'function'
            ? (source: UnitType) => filterOrSource(source)
            : (source: UnitType) => source === filterOrSource

      for (const die of data) {
        if (predicate(die[2])) {
          die[0] = Math.max(1, die[0] + amount)
        }
      }
    },

    addDice: (
      count: number,
      strategyOrSource?: 'BEST' | 'WORST' | UnitType,
    ) => {
      if (data.length === 0) return

      let targetIndex: number

      if (
        strategyOrSource === undefined ||
        strategyOrSource === 'BEST' ||
        strategyOrSource === 'WORST'
      ) {
        const isBest =
          strategyOrSource === undefined || strategyOrSource === 'BEST'
        targetIndex = 0
        for (let i = 1; i < data.length; i++) {
          const better = isBest
            ? data[i][0] < data[targetIndex][0]
            : data[i][0] > data[targetIndex][0]
          if (better) targetIndex = i
        }
      } else {
        const sourceIndex = data.findIndex(d => d[2] === strategyOrSource)
        if (sourceIndex === -1) return
        targetIndex = sourceIndex
      }

      data[targetIndex] = [
        data[targetIndex][0],
        data[targetIndex][1] + count,
        data[targetIndex][2],
      ]
    },
  } as DiceApi

  return api
}
