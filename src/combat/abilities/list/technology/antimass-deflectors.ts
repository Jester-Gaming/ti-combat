import type { Ability, DiceContext, DiceReadContext } from '../../types'

type Params = {
  isEnabled: boolean
}

export const antimassDeflectors: Ability<Params> = {
  key: 'ANTIMASS_DEFLECTORS',
  name: 'Antimass Deflectors',
  category: 'TECHNOLOGY',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (params: Params, _ctx, dice: DiceReadContext) => {
        return params.isEnabled && !dice.opponent.isEmpty()
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.opponent.modifyHitValue(1)
      },
    },
  ],
}
