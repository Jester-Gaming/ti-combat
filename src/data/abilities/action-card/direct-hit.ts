import { getUnitLocator } from '@/combat/utils/compact-units'
import { parseVariantId } from '@/combat/utils/unit-variant'
import type { UnitBaseType, UnitLocator } from '@/types'

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
      isCallable: (_params, ctx, unit: UnitLocator) => {
        const { type: unitType } = parseVariantId(unit.key)
        // Only target ships — not mechs or ground forces
        const settings = ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ships = (settings?.ships as UnitBaseType[]) ?? []
        if (!ships.includes(unitType)) return false
        // Check DIRECT_HIT_IMMUNE on the specific unit
        const units = ctx.api.opponent.getUnits(unitType)
        const target = units.find(u => {
          const loc = getUnitLocator(u)
          return loc?.key === unit.key && loc?.index === unit.index
        })
        return target ? !target.DIRECT_HIT_IMMUNE : false
      },
      call: (ctx, _params, unit: UnitLocator) => {
        ctx.api.opponent.destroyUnit(unit)
      },
    },
  ],
}
