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
      timing: 'AFTER_ASSIGN_HITS_STEP',
      isCallable: (params, ctx) => findRepairTarget(params, ctx) !== undefined,
      call: (ctx, params) => {
        const target = findRepairTarget(params, ctx)
        if (!target) return
        ctx.api.own.modifyUnit(target, { isDamaged: false })
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
        items: ctx.api.own.getParticipatingVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
