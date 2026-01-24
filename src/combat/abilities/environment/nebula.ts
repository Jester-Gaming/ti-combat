import type { DieValue } from '@/types'

import type {
  Ability,
  AbilityReadContext,
  DiceData,
  StateChange,
} from '../types'

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
      isCallable: (_: AbilityReadContext, params: Params) => {
        return params.isEnabled
      },
      call: (
        ctx: AbilityReadContext,
        _params: Params,
        diceData: DiceData,
      ): StateChange<DiceData> => {
        return {
          state: ctx.state as typeof ctx.state & object,
          context: {
            own: applyDiceBonus(diceData.own),
            opponent: diceData.opponent,
          },
        }
      },
    },
  ],
}
