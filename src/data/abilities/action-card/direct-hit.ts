import type { Unit, UnitType } from '@/types'

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
      isCallable: (_params, ctx, unit: Unit) => {
        if (unit.DIRECT_HIT_IMMUNE) return false
        // Only target ships — not mechs or ground forces
        const settings = ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ships = (settings?.ships as UnitType[]) ?? []
        return ships.some(type =>
          ctx.api.opponent.getUnits(type).includes(unit),
        )
      },
      call: (ctx, _params, unit: Unit) => {
        ctx.api.opponent.destroyUnit(unit)
      },
    },
  ],
}
