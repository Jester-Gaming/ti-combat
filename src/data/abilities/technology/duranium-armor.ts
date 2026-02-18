import type { Unit, UnitType } from '@/types'

import { declareParam } from '../../../combat/abilities/declare-param'
import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'
import {
  parseVariantId,
  unitMatchesVariant,
} from '../../../combat/utils/unit-variant'

type Params = {
  spaceRepairPriority: string[]
  groundRepairPriority: string[]
}

function findRepairTarget(params: Params, ctx: AbilityReadContext) {
  const isGround = ctx.state.combatMode === 'GROUND'
  const priority = isGround
    ? params.groundRepairPriority
    : params.spaceRepairPriority

  for (const variantId of priority) {
    const { type: unitType } = parseVariantId(variantId)
    const units = ctx.api.own.getUnits(unitType)
    if (!units) continue

    for (const unit of units) {
      if (!unitMatchesVariant(unit, variantId)) continue
      if (!unit.isDamaged) continue
      if (unit.usedSustainThisRound) continue
      return unit
    }
  }

  return undefined
}

export const duraniumArmor: Ability<Params> = {
  key: 'DURANIUM_ARMOR',
  name: 'Duranium Armor',
  category: 'TECHNOLOGY',
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
      side: 'OWN',
      call: (ctx, _params, unit: Unit) => {
        ctx.api.own.modifyUnit(unit, { usedSustainThisRound: true })
      },
    },
    {
      timing: 'AFTER_ASSIGN_HITS_STEP',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      isCallable: (params, ctx) => findRepairTarget(params, ctx) !== undefined,
      call: (ctx, params) => {
        const target = findRepairTarget(params, ctx)
        if (!target) return
        ctx.api.own.modifyUnit(target, { isDamaged: false })
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      isCallable: (_params, ctx) => {
        for (const units of Object.values(ctx.api.own.getUnits())) {
          if (units!.some(u => u.usedSustainThisRound)) return true
        }
        return false
      },
      call: ctx => {
        for (const [type, units] of Object.entries(ctx.api.own.getUnits())) {
          for (const unit of units!) {
            if (unit.usedSustainThisRound) {
              ctx.api.own.modifyUnit(type as UnitType, units!.indexOf(unit), {
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
        label: 'Repair Priority',
        type: 'order-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
