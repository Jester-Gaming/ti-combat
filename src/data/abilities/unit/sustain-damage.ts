import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability, AbilityReadContext } from '@/combat/abilities/types'
import { getUnitLocator } from '@/combat/utils/compact-units'
import { parseVariantId, unitMatchesVariant } from '@/combat/utils/unit-variant'

type Params = {
  spacePriority: string[]
  groundPriority: string[]
}

/**
 * Check if this unit is the highest-priority sustain target.
 * Iterates the priority list and returns true only if the first
 * eligible undamaged unit is the one this ability is attached to.
 */
function isHighestPrioritySustainTarget(
  params: Params,
  ctx: AbilityReadContext,
): boolean {
  const isGround = ctx.state.combatMode === 'GROUND'
  const priority = isGround ? params.groundPriority : params.spacePriority
  const allowedUnits = new Set(priority)

  const validTargets = ctx.api.own.getHitPoolValidTargets()
  const validTargetSet = validTargets.length > 0 ? new Set(validTargets) : null

  const myLocator = ctx.getUnit()

  for (const variantId of priority) {
    const { type: unitType } = parseVariantId(variantId)
    if (!allowedUnits.has(variantId)) continue
    if (validTargetSet && !validTargetSet.has(unitType)) continue
    if (
      ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
      ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
    ) {
      continue
    }

    const units = ctx.api.own.getUnits(unitType)
    if (!units) continue

    for (const unit of units) {
      if (!unitMatchesVariant(unit, variantId)) continue
      if (unit.isDamaged) continue
      if (!unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE) continue
      // Found the highest-priority eligible unit — is it us?
      const loc = getUnitLocator(unit)
      return (
        loc !== undefined &&
        loc.key === myLocator.key &&
        loc.index === myLocator.index
      )
    }
  }

  return false
}

export const sustainDamage: Ability<Params> = {
  key: 'SUSTAIN_DAMAGE',
  name: 'Sustain Damage',
  category: 'GENERAL',
  params: {
    isEnabled: true,
    uses: Infinity,
    spacePriority: declareParam({
      default: [],
      source: 'nonFighterShips',
    }),
    groundPriority: declareParam({
      default: [],
      source: 'groundForces',
    }),
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (params, ctx) => {
        if (ctx.api.own.getPendingHits() <= 0) return false

        if (ctx.getUnitState().isDamaged) return false
        if (!ctx.getUnitStats().UNIT_ABILITIES?.SUSTAIN_DAMAGE) return false

        const unitType = ctx.getUnitType()
        const variantId = ctx.getUnit().key

        const isGround = ctx.state.combatMode === 'GROUND'
        const allowedUnits = new Set(
          isGround ? params.groundPriority : params.spacePriority,
        )
        if (!allowedUnits.has(variantId)) return false

        const validTargets = ctx.api.own.getHitPoolValidTargets()
        if (validTargets.length > 0 && !validTargets.includes(unitType)) {
          return false
        }

        if (
          ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
        ) {
          return false
        }

        return isHighestPrioritySustainTarget(params, ctx)
      },
      call: ctx => {
        ctx.api.own.modifyUnitState(ctx.getUnit(), { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.log(ctx.getUnitType())
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', ctx.getUnit())
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', ctx.getUnit())
      },
    },
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround
      ? ('groundPriority' as const)
      : ('spacePriority' as const)

    return [
      {
        key,
        label: 'Sustain Priority',
        type: 'priority-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
