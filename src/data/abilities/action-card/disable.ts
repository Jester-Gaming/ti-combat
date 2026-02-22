import type { Ability } from '../../../combat/abilities-engine/types'

export const disable: Ability = {
  key: 'DISABLE',
  name: 'Disable',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost(
          'PLANETARY_SHIELD',
          'DISABLE',
          'PDS',
        )
        ctx.api.opponent.setUnitAbilityLost('SPACE_CANNON', 'DISABLE', 'PDS')
      },
    },
  ],
}
