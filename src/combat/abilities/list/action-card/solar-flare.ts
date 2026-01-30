import type { Ability } from '../../types'

type Params = {
  isEnabled: boolean
}

export const solarFlare: Ability<Params> = {
  key: 'SOLAR_FLARE',
  name: 'Solar Flare',
  category: 'ACTION_CARD',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE_SPACE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'SOLAR_FLARE',
        )
      },
    },
  ],
}
