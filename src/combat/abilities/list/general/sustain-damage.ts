import type { UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import {
  getPendingHits,
  reduceHits,
  updateUnit,
} from '../../../state/side-state-ops'
import type { SideState, Unit } from '../../../state/types'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

/** Get units that are present on the side and have sustain damage ability */
function getSustainUnitsForSide(side: SideState): UnitType[] {
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
  sideState: SideState,
  allowedUnits: Set<UnitType>,
  priority: UnitType[],
): { type: UnitType; unit: Unit; index: number } | null {
  for (const unitType of priority) {
    if (!allowedUnits.has(unitType)) continue

    const units = sideState.units[unitType]
    if (!units) continue

    const index = units.findIndex(unit => !unit.isDamaged)
    if (index >= 0) {
      return { type: unitType, unit: units[index], index }
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
      isCallable: (ctx: AbilityReadContext, params: Params) => {
        const hasHits = getPendingHits(ctx.own) > 0
        if (!hasHits) return false

        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        return findUnitToSustain(ctx.own, allowedUnits, priority) !== null
      },
      call: (ctx: AbilityReadContext, params: Params): StateChange<void> => {
        const hitPerSustain = params.hitPerSustain ?? 1
        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        const target = findUnitToSustain(ctx.own, allowedUnits, priority)

        if (!target) {
          return { state: ctx.state as typeof ctx.state & object }
        }

        let newState = updateUnit(
          ctx.state as typeof ctx.state & object,
          ctx.side,
          target.type,
          target.index,
          {
            isDamaged: true,
            usedSustainThisRound: true,
          },
        )
        newState = reduceHits(newState, ctx.side, hitPerSustain)

        return { state: newState }
      },
    },
  ],
}
