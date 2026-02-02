import { getVariantDisplayName } from '@/combat/utils/unit-variant'
import { GROUND_FORCES, NON_FIGHTER_SHIPS, UNIT_TYPES } from '@/constants/units'
import type { Unit, UnitType } from '@/types'

import type { Ability, AbilityReadContext, SideReadApi } from '../../types'

type Params = {
  hitPerSustain: number
  spaceUnits: UnitType[]
  groundUnits: UnitType[]
  spaceUnitPriority: UnitType[]
  groundUnitPriority: UnitType[]
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
    spaceUnits: UNIT_TYPES,
    groundUnits: UNIT_TYPES,
    spaceUnitPriority: NON_FIGHTER_SHIPS.toReversed(),
    groundUnitPriority: GROUND_FORCES.toReversed(),
  },
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const unitsKey = isGround
      ? ('groundUnits' as const)
      : ('spaceUnits' as const)
    const priorityKey = isGround
      ? ('groundUnitPriority' as const)
      : ('spaceUnitPriority' as const)

    const participatingUnits = ctx.api.own.getParticipatingVariants({
      exclude: ['FIGHTER'],
    })
    const participatingItems = participatingUnits.map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))

    return [
      {
        key: unitsKey,
        label: 'Sustain Units',
        type: 'checkbox-list' as const,
        items: participatingItems,
      },
      {
        key: priorityKey,
        label: 'Sustain Priority',
        type: 'order-list' as const,
        items: participatingItems,
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      multi: true,
      isCallable: (params: Params, ctx: AbilityReadContext) => {
        const hasHits = ctx.api.own.getPendingHits() > 0
        if (!hasHits) return false

        const isGround = ctx.state.combatMode === 'GROUND'
        const allowedUnits = new Set(
          isGround ? params.groundUnits : params.spaceUnits,
        )
        const priority = isGround
          ? params.groundUnitPriority
          : params.spaceUnitPriority
        return findUnitToSustain(ctx.api.own, allowedUnits, priority) !== null
      },
      call: (ctx, params: Params) => {
        const hitPerSustain = params.hitPerSustain ?? 1
        const isGround = ctx.state.combatMode === 'GROUND'
        const allowedUnits = new Set(
          isGround ? params.groundUnits : params.spaceUnits,
        )
        const priority = isGround
          ? params.groundUnitPriority
          : params.spaceUnitPriority
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
