import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const l4Disruptors: Ability<Params> = {
  key: 'L4_DISRUPTORS',
  name: 'L4 Disruptors',
  category: 'FACTION',
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
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'L4_DISRUPTORS',
        )
      },
    },
  ],
}
