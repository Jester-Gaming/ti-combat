import type { Unit, UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import type { Ability, AbilityReadContext, SideReadApi } from '../../types'

/** Get units from the read API that have sustain damage ability */
function getSustainUnitsFromApi(api: SideReadApi): UnitType[] {
  const allUnits = api.getUnits() as Partial<Record<UnitType, Unit[]>>
  const result: UnitType[] = []
  for (const [unitType, units] of Object.entries(allUnits)) {
    if (units && units.length > 0) {
      const hasSustain = units.some(u => u.UNIT_ABILITIES?.SUSTAIN_DAMAGE)
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
  api: SideReadApi,
  allowedUnits: Set<UnitType>,
  priority: UnitType[],
): { type: UnitType; unit: Unit; index: number } | null {
  const validTargets = api.getHitPoolValidTargets()
  const validTargetSet = validTargets.length > 0 ? new Set(validTargets) : null

  for (const unitType of priority) {
    if (!allowedUnits.has(unitType)) continue
    if (validTargetSet && !validTargetSet.has(unitType)) continue
    if (
      api.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
      api.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
    ) {
      continue
    }

    const units = api.getUnits(unitType)
    if (!units) continue

    const index = units.findIndex(
      unit => !unit.isDamaged && unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE,
    )
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
  uiConfig: (ctx, params) => {
    const sustainUnits = getSustainUnitsFromApi(ctx.api.own)
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
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        const hasHits = ctx.api.own.getPendingHits() > 0
        if (!hasHits) return false

        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        return findUnitToSustain(ctx.api.own, allowedUnits, priority) !== null
      },
      call: (ctx, params: Params) => {
        const hitPerSustain = params.hitPerSustain ?? 1
        const allowedUnits = new Set(params.units)
        const priority = params.unitPriority
        const target = findUnitToSustain(ctx.api.own, allowedUnits, priority)

        if (!target) return

        ctx.log(target.type)
        ctx.api.own.modifyUnit(target.type, target.index, {
          isDamaged: true,
          usedSustainThisRound: true,
        })
        ctx.api.own.reduceHits(hitPerSustain)
      },
    },
  ],
}
