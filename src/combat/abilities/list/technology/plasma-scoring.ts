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

export const plasmaScoring: Ability<Params> = {
  key: 'PLASMA_SCORING',
  name: 'Plasma Scoring',
  category: 'TECHNOLOGY',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (
        _ctx: AbilityReadContext,
        params: Params,
        diceData: DiceData,
      ) => {
        return params.isEnabled && diceData.own.length > 0
      },
      call: (
        ctx: AbilityReadContext,
        _params: Params,
        diceData: DiceData,
      ): StateChange<DiceData> => {
        // Find the best (lowest) hit value among own dice
        let bestIndex = 0
        let bestHitValue = diceData.own[0][0]
        for (let i = 1; i < diceData.own.length; i++) {
          if (diceData.own[i][0] < bestHitValue) {
            bestHitValue = diceData.own[i][0]
            bestIndex = i
          }
        }

        // Add 1 additional die to the best value entry
        const modifiedDice = diceData.own.map((die, i) => {
          if (i === bestIndex) {
            return [die[0], die[1] + 1, die[2]] as DieValue
          }
          return die
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
