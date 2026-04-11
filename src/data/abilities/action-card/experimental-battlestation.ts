import type { UnitId } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

export const experimentalBattlestation: Ability = {
  key: 'EXPERIMENTAL_BATTLESTATION',
  name: 'Experimental Battlestation',
  description:
    'After another player moves ships into a system during a tactical action: Choose 1 of your space docks that is either in or adjacent to that system. That space dock uses Space Cannon 5 (x3) against ships in the active system.',
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
