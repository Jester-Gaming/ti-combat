import type { DieValue } from '@/types'

import type { Ability, AbilityReadContext, DiceData } from '../../types'

type Params = {
  isEnabled: boolean
  strategy: 'BEST' | 'WORST'
}

export const plasmaScoring: Ability<Params> = {
  key: 'PLASMA_SCORING',
  name: 'Plasma Scoring',
  category: 'TECHNOLOGY',
  defaultParams: {
    isEnabled: false,
    strategy: 'BEST',
  },
  enableUI: true,
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (
        params: Params,
        _ctx: AbilityReadContext,
        diceData: DiceData,
      ) => {
        return params.isEnabled && diceData.own.length > 0
      },
      call: (_ctx, params: Params, diceData: DiceData) => {
        // Find the target die based on strategy
        let targetIndex = 0
        let targetHitValue = diceData.own[0][0]
        for (let i = 1; i < diceData.own.length; i++) {
          const isBetter =
            params.strategy === 'BEST'
              ? diceData.own[i][0] < targetHitValue
              : diceData.own[i][0] > targetHitValue
          if (isBetter) {
            targetHitValue = diceData.own[i][0]
            targetIndex = i
          }
        }

        // Add 1 additional die to the target entry
        const modifiedDice = diceData.own.map((die, i) => {
          if (i === targetIndex) {
            return [die[0], die[1] + 1, die[2]] as DieValue
          }
          return die
        })

        return {
          own: modifiedDice,
          opponent: diceData.opponent,
        }
      },
    },
  ],
}
