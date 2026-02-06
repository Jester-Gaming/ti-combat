import type { Unit } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

export const directHit: Ability = {
  key: 'DIRECT_HIT',
  name: 'Direct Hit',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OPPONENT',
      isCallable: (_params, _ctx, unit: Unit) => {
        return !unit.DIRECT_HIT_IMMUNE
      },
      call: (ctx, _params, unit: Unit) => {
        ctx.api.opponent.destroyUnit(unit)
      },
    },
  ],
}
