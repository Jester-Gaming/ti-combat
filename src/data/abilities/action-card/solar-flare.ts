import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const solarFlare: Ability<Params> = {
  key: 'SOLAR_FLARE',
  name: 'Solar Flare',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
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
