import type { DieValue } from '@/types'

import type { Ability, AbilityContext, DiceData } from '../types'
import { getMyDice, setMyDice } from '../types'

type Params = {
  isEnabled: boolean
}

/** Apply +1 modifier to dice (reduce hitValue by 1, minimum 1) */
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
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (_: AbilityContext, params: Params) => {
        return params.isEnabled
      },
      call: (ctx: AbilityContext, _params: Params, context?: unknown) => {
        const diceData = context as DiceData | undefined
        if (!diceData) return
        // Nebula gives +1 to the owning side's dice
        const myDice = getMyDice(ctx, diceData)
        setMyDice(ctx, diceData, applyDiceBonus(myDice))
      },
    },
  ],
}
