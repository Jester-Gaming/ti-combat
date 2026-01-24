import type { DieValue } from '@/types'

import type { Ability, AbilityContext, DiceData } from '../types'

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

export const nebula: Ability<Params> = {
  key: 'NEBULA',
  name: 'Nebula',
  category: 'ENVIRONMENT',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_: AbilityContext, params: Params) => {
        return params.isEnabled
      },
      call: (_ctx: AbilityContext, _params: Params, diceData: DiceData) => {
        diceData.own = applyDiceBonus(diceData.own)
      },
    },
  ],
}
