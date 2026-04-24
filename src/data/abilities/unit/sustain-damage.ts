import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
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
  sort: (params, ctx, unitIds) => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const priority = isGround ? params.groundPriority : params.spacePriority

    const remaining = new Set(unitIds)
    const result: UnitId[] = []
    for (const variantId of priority) {
      for (const id of ctx.api.own.getUnits(variantId as UnitType)) {
        if (remaining.has(id)) {
          result.push(id)
          remaining.delete(id)
        }
      }
    }
    for (const id of unitIds) {
      if (remaining.has(id)) result.push(id)
    }
    return result
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
        const allowedUnits = isGround
          ? params.groundPriority
          : params.spacePriority
        if (!allowedUnits.includes(variantId)) return false

        const validTargets = ctx.api.own.getHitPoolValidTargets()
        if (validTargets && !validTargets.includes(unitType as UnitType)) {
          return false
        }

        if (
          ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
        ) {
          return false
        }

        return true
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
