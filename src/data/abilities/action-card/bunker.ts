import type { Ability } from '../../../combat/abilities/types'

export const bunker: Ability = {
  key: 'BUNKER',
  name: 'Bunker',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  side: 'defender',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      call: ctx => {
        ctx.api.opponent.modifyHitValue(4)
      },
    },
  ],
}
