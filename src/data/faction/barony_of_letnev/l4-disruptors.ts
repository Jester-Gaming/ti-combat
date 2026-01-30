import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const l4Disruptors: Ability<Params> = {
  key: 'L4_DISRUPTORS',
  name: 'L4 Disruptors',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'PREPARE_GROUND',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'L4_DISRUPTORS',
        )
      },
    },
  ],
}
