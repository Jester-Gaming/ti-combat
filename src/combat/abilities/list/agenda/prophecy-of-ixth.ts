import type { DieValue } from '@/types'

import type {
  Ability,
  AbilityReadContext,
  DiceData,
  StateChange,
} from '../../types'

type Params = {
  isEnabled: boolean
}

export const prophecyOfIxth: Ability<Params> = {
  key: 'PROPHECY_OF_IXTH',
  name: 'Prophecy of Ixth',
  category: 'AGENDA',
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
        const modifiedDice = diceData.own.map(([hitValue, count, source]) => {
          if (source === 'FIGHTER') {
            return [Math.max(1, hitValue - 1), count, source] as DieValue
          }
          return [hitValue, count, source] as DieValue
        })

        return {
          state: ctx.state,
          context: {
            own: modifiedDice,
            opponent: diceData.opponent,
          },
        }
      },
    },
  ],
}
