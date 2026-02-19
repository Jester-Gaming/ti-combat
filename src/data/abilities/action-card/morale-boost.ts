import type { Ability } from '../../../combat/abilities/types'

export const moraleBoost: Ability = {
  key: 'MORALE_BOOST',
  name: 'Morale Boost',
  category: 'ACTION_CARD',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}
