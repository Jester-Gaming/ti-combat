import { getUnitId } from '@/combat/utils/compact-units'
import type { UnitBaseType } from '@/types'

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
      isCallable: (_params, ctx, unitId) => {
        // Only target ships — not mechs or ground forces
        const settings = ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ships = (settings?.ships as UnitBaseType[]) ?? []
        // Find the unit among opponent's ships
        for (const shipType of ships) {
          const units = ctx.api.opponent.getUnits(shipType)
          const target = units.find(u => getUnitId(u) === unitId)
          if (target) return !target.DIRECT_HIT_IMMUNE
        }
        return false
      },
      call: (ctx, _params, unitId) => {
        ctx.api.opponent.destroyUnit(unitId)
      },
    },
  ],
}
