import type { DieValue } from '@/types'

import type { Ability, AbilityContext, DiceData } from '../types'
import { getMyDice, setMyDice } from '../types'

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
      isCallable: (_: AbilityContext, params: Params) => {
        return params.isEnabled
      },
      call: (ctx: AbilityContext, _params: Params, context?: unknown) => {
        const diceData = context as DiceData | undefined
        if (!diceData) return

        // +1 to my fighter dice only
        const myDice = getMyDice(ctx, diceData)
        const modifiedDice = myDice.map(([hitValue, count, source]) => {
          if (source === 'FIGHTER') {
            return [Math.max(1, hitValue - 1), count, source] as DieValue
          }
          return [hitValue, count, source] as DieValue
        })
        setMyDice(ctx, diceData, modifiedDice)
      },
    },
  ],
}
