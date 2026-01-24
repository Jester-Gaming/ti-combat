import type { UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import type { CombatSideState, Unit } from '../../state/combat-side-state'
import type { Ability, AbilityContext } from '../types'

/** Get units that are present on the side and have sustain damage ability */
function getSustainUnitsForSide(side: CombatSideState): UnitType[] {
  const result: UnitType[] = []
  for (const [unitType, units] of Object.entries(side.units)) {
    if (units && units.length > 0) {
      const hasSustain = units.some(u => u.ABILITIES?.SUSTAIN_DAMAGE)
      if (hasSustain) {
        result.push(unitType as UnitType)
      }
    }
  }
  return result
}

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
  defaultParams: {
    hitPerSustain: 1,
    units: ['DREADNOUGHT', 'MECH', 'FLAGSHIP'],
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
  uiConfig: (side, params) => {
    const sustainUnits = getSustainUnitsForSide(side)
    const sustainUnitItems = getUnitListItems(sustainUnits)
    const sustainUnitsSet = new Set(sustainUnits)
    const validUnits = params.units.filter(u => sustainUnitsSet.has(u))

    return [
      ...(sustainUnitItems.length > 0
        ? [
            {
              key: 'units' as const,
              label: 'Sustain Units',
              type: 'checkbox-list' as const,
              items: sustainUnitItems,
            },
          ]
        : []),
      ...(validUnits.length > 0
        ? [
            {
              key: 'unitPriority' as const,
              label: 'Sustain Priority',
              type: 'order-list' as const,
              items: getUnitListItems(validUnits),
            },
          ]
        : []),
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      multi: true,
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
        }
      },
    },
  ],
}
