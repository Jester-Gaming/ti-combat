import type { Ability } from '../../types'

type Params = {
  isEnabled: boolean
}

export const disable: Ability<Params> = {
  key: 'DISABLE',
  name: 'Disable',
  category: 'ACTION_CARD',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE_GROUND',
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
