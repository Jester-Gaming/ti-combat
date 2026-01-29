import type { DieValue } from '@/types'

import type { Ability, DiceData } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

function applyDiceBonus(dice: DieValue[]): DieValue[] {
  return dice.map(([hitValue, count, source]) => [
    Math.max(1, hitValue - 1),
    count,
    source,
  ])
}

export const arozHollow: Ability<Params> = {
  key: 'AROZ_HOLLOW',
  name: '(Obsidian) Aroz Hollow',
  category: 'COMMANDER',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (_ctx, _params: Params, diceData: DiceData) => {
        return {
          own: applyDiceBonus(diceData.own),
          opponent: diceData.opponent,
        }
      },
    },
  ],
}
