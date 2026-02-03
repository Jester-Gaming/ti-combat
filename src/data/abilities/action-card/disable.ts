import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const disable: Ability<Params> = {
  key: 'DISABLE',
  name: 'Disable',
  category: 'ACTION_CARD',
  context: 'GROUND',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
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
