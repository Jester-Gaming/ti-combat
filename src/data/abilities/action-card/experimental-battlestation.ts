import type { UnitId } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

export const experimentalBattlestation: Ability = {
  key: 'EXPERIMENTAL_BATTLESTATION',
  name: 'Experimental Battlestation',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  side: 'defender',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      call: (_ctx, _params, dice) => {
        dice.own.addDiceGroup('EXPERIMENTAL_BATTLESTATION', 0 as UnitId, [5, 3])
      },
    },
  ],
}
