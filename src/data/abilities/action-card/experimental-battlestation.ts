import type { Unit } from '@/types'

import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const experimentalBattlestation: Ability<Params> = {
  key: 'EXPERIMENTAL_BATTLESTATION',
  name: 'Experimental Battlestation',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: (params: Params) => params.isEnabled,
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.addDiceGroup('EXPERIMENTAL_BATTLESTATION', {} as Unit, [5, 3])
      },
    },
  ],
}
