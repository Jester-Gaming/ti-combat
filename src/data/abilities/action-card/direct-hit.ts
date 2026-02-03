import type { Unit } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

type Params = {
  uses: number
}

export const directHit: Ability<Params> = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OPPONENT',
      isCallable: (params: Params, _ctx, unit: Unit) => {
        return params.uses > 0 && !unit.DIRECT_HIT_IMMUNE
      },
      call: (ctx, params: Params, unit: Unit) => {
        ctx.api.opponent.destroyUnit(unit)
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
