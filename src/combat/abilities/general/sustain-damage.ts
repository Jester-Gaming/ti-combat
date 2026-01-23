import type { UnitType } from '@/types'
import { getUnitListItems, UNIT_LIST_ITEMS } from '@/utils/get-unit-config'

import type { Unit } from '../../types'
import type { Ability, AbilityContext } from '../types'

type Params = {
  hitPerSustain: number
  units: UnitType[]
  unitPriority: UnitType[]
}

/** Find the first undamaged unit that can sustain, following priority order */
function findUnitToSustain(
  ctx: AbilityContext,
  allowedUnits: Set<UnitType>,
  priority: UnitType[],
): { type: UnitType; unit: Unit } | null {
  for (const unitType of priority) {
    if (!allowedUnits.has(unitType)) continue

    const units = ctx.my.units[unitType]
    if (!units) continue

    const undamaged = units.find(unit => !unit.isDamaged)
    if (undamaged) {
      return { type: unitType, unit: undamaged }
    }
  }
  return null
}

export const sustainDamage: Ability<Params> = {
  key: 'SUSTAIN_DAMAGE',
  name: 'Sustain Damage',
  category: 'GENERAL',
  defaultCollapsed: true,
  params: {
    hitPerSustain: 1,
    units: ['DREADNOUGHT', 'WAR_SUN', 'MECH', 'FLAGSHIP'],
    unitPriority: [
      'FIGHTER',
      'INFANTRY',
      'DESTROYER',
      'CRUISER',
      'CARRIER',
      'DREADNOUGHT',
      'MECH',
      'WAR_SUN',
      'FLAGSHIP',
    ],
  },
  uiConfig: params => [
    {
      key: 'units',
      label: 'Sustain Units',
      type: 'checkbox-list',
      items: UNIT_LIST_ITEMS,
    },
    ...(params.units.length > 1
      ? [
          {
            key: 'unitPriority' as const,
            label: 'Sustain Priority',
            type: 'order-list' as const,
            items: getUnitListItems(params.units),
          },
        ]
      : []),
  ],
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (ctx: AbilityContext, params: Params) => {
        const hasHits = ctx.my.pendingHits > 0
        if (!hasHits) return false

        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        return findUnitToSustain(ctx, allowedUnits, priority) !== null
      },
      call: (ctx: AbilityContext, params: Params) => {
        const hitPerSustain = params.hitPerSustain ?? 1
        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        const target = findUnitToSustain(ctx, allowedUnits, priority)

        if (target) {
          target.unit.isDamaged = true
          ctx.my.reduceHits(hitPerSustain)
          ctx.state.triggerEvent('SUSTAIN_DAMAGE', target.unit)
        }
      },
    },
  ],
}
