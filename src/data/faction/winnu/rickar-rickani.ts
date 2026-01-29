import type { DieValue } from '@/types'

import type {
  Ability,
  AbilityReadContext,
  DiceData,
  StateChange,
} from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

function applyDiceBonus(dice: DieValue[]): DieValue[] {
  return dice.map(([hitValue, count, source]) => [
    Math.max(1, hitValue - 2),
    count,
    source,
  ])
}

export const rickarRickani: Ability<Params> = {
  key: 'RICKAR_RICKANI',
  name: '(Winnu) Rickar Rickani',
  category: 'COMMANDER',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
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
          state: ctx.state,
          context: {
            own: applyDiceBonus(diceData.own),
            opponent: diceData.opponent,
          },
        }
      },
    },
  ],
}
