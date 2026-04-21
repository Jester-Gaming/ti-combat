import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityReadContext,
  declareParam,
  parseVariantId,
} from '@/combat'
import type { UnitId, UnitType } from '@/types'

type Params = {
  spacePriority: UnitType[]
  groundPriority: UnitType[]
}

declare global {
  /** Fires around a Sustain Damage use. Payload is the sustaining unit's id.
   *  `WHEN_` fires immediately; `AFTER_` fires right after. */
  interface TimingContextMap {
    WHEN_SUSTAIN_DAMAGE_USE: UnitId
    AFTER_SUSTAIN_DAMAGE_USE: UnitId
  }

  interface AbilityConfigMap {
    SUSTAIN_DAMAGE: Params
  }
}

export const sustainDamage: Ability<Params> = {
  key: 'SUSTAIN_DAMAGE',
  name: 'Sustain Damage',
  category: 'GENERAL',
  paramsSchema: z.object({
    spacePriority: z.array(z.string()),
    groundPriority: z.array(z.string()),
  }),
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

        const unitId = ctx.getUnit()
        if (ctx.api.own.getUnitState(unitId)?.isDamaged) return false
        if (!ctx.api.own.getUnitStats(unitId)?.UNIT_ABILITIES?.SUSTAIN_DAMAGE)
          return false

        const unitType = ctx.api.own.getUnitBaseType(unitId)!
        const variantId = ctx.api.own.getVariantKey(unitId)! as UnitType

        const isGround = ctx.state.combatMode === 'GROUND'
        const allowedUnits = new Set(
          isGround ? params.groundPriority : params.spacePriority,
        )
        if (!allowedUnits.has(variantId)) return false

        const validTargets = ctx.api.own.getHitPoolValidTargets()
        if (
          validTargets.length > 0 &&
          !validTargets.includes(unitType as UnitType)
        ) {
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
        ctx.logger?.log(ctx.api.own.getUnitBaseType(ctx.getUnit()))
        // Triggered steps pop LIFO — push AFTER first so WHEN runs first.
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', ctx.getUnit())
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', ctx.getUnit())
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
        type: 'priority-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
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

  const myUnitId = ctx.getUnit()

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

    const units = ctx.api.own.getUnits(variantId)
    if (units.length === 0) continue
    const stats = ctx.api.own.getUnitStats(variantId)
    if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) continue

    for (const unit of units) {
      const state = ctx.api.own.getUnitState(unit)
      if (state?.isDamaged) continue
      // Found the highest-priority eligible unit — is it us?
      return unit === myUnitId
    }
  }

  return false
}
