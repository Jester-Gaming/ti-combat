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
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      side: 'OWN',
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
        label: 'Repair Priority',
        type: 'order-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
        }),
      },
    ]
  },
}
