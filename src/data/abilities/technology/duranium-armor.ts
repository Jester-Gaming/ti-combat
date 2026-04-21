import { z } from 'zod/mini'

import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities-engine/types'
import type { UnitId, UnitType } from '../../../types'

type Params = {
  spaceRepairPriority: UnitType[]
  groundRepairPriority: UnitType[]
}

export const duraniumArmor: Ability<Params> = {
  key: 'DURANIUM_ARMOR',
  name: 'Duranium Armor',
  description:
    'During each combat round, after you assign hits to your units, repair 1 of your damaged units that did not use Sustain Damage during this combat round.',
  category: 'TECHNOLOGY',
  paramsSchema: z.object({
    spaceRepairPriority: z.array(z.string()),
    groundRepairPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    spaceRepairPriority: declareParam({
      default: [],
      source: 'nonFighterShips',
    }),
    groundRepairPriority: declareParam({
      default: [],
      source: 'groundForces',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      call: (ctx, _params, unit) => {
        ctx.api.own.modifyUnitState(unit, { usedSustainThisRound: true })
      },
    },
    {
      timing: 'AFTER_ASSIGN_HITS_STEP',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      isCallable: (params, ctx) => findRepairTarget(params, ctx) !== undefined,
      call: (ctx, params) => {
        const target = findRepairTarget(params, ctx)!
        ctx.api.own.modifyUnitState(target, { isDamaged: false })
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      isCallable: (_params, ctx) => {
        for (const type of ctx.api.own.getParticipatingUnitTypes()) {
          for (const id of ctx.api.own.getUnits(type, {
            includeVariants: true,
          })) {
            if (ctx.api.own.getUnitState(id)?.usedSustainThisRound) return true
          }
        }
        return false
      },
      call: ctx => {
        for (const type of ctx.api.own.getParticipatingUnitTypes()) {
          for (const id of ctx.api.own.getUnits(type, {
            includeVariants: true,
          })) {
            if (ctx.api.own.getUnitState(id)?.usedSustainThisRound) {
              ctx.api.own.modifyUnitState(id, {
                usedSustainThisRound: false,
              })
            }
          }
        }
      },
    },
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround
      ? ('groundRepairPriority' as const)
      : ('spaceRepairPriority' as const)

    return [
      {
        key,
        type: 'order-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}

function findRepairTarget(
  params: Params,
  ctx: AbilityReadContext,
): UnitId | undefined {
  const isGround = ctx.state.combatMode === 'GROUND'
  const priority = isGround
    ? params.groundRepairPriority
    : params.spaceRepairPriority

  for (const variantId of priority) {
    for (const unitId of ctx.api.own.getUnits(variantId)) {
      const state = ctx.api.own.getUnitState(unitId)
      if (!state?.isDamaged) continue
      if (state.usedSustainThisRound) continue
      return unitId
    }
  }

  return undefined
}
