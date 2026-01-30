import type { Ability, DiceContext, DiceReadContext } from '../../types'

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
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.isEnabled && !dice.own.isEmpty()
      },
      call: (_ctx, params: Params, dice: DiceContext) => {
        dice.own.addDice(1, params.strategy)
      },
    },
  ],
}
