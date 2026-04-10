import { z } from 'zod/mini'

import { UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType, UnitType } from '@/types'

import type {
  Ability,
  AbilityCallContext,
} from '../../../combat/abilities-engine/types'
import { parseVariantId } from '../../../combat/utils'

type Params = {
  removePriority: UnitType[]
}

const DEFAULT_PRIORITY: UnitBaseType[] = ['FIGHTER', 'INFANTRY', 'MECH']

/** Compute total ship capacity for a side */
export function computeTotalCapacity(ctx: AbilityCallContext): number {
  const api = ctx.api.own
  let totalCapacity = 0
  for (const baseType of UNIT_TYPES) {
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST != null) continue
    const cap = stats.CAPACITY
    if (cap != null && cap > 0) {
      totalCapacity += cap * api.countUnits(baseType, { includeVariants: true })
    }
  }
  return totalCapacity
}

function enforceCapacity(
  ctx: AbilityCallContext,
  removePriority: UnitType[],
): void {
  const api = ctx.api.own

  const totalCapacity = computeTotalCapacity(ctx)

  // Collect carried units (CAPACITY_COST != null)
  const carriedTypes: {
    baseType: UnitBaseType
    cost: number
    hasFleetPool: boolean
  }[] = []
  for (const baseType of UNIT_TYPES) {
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST == null) continue
    const count = api.countUnits(baseType, { includeVariants: true })
    if (count === 0) continue
    carriedTypes.push({
      baseType,
      cost: stats.CAPACITY_COST,
      hasFleetPool: typeof stats.FLEET_POOL_COST === 'number',
    })
  }

  if (carriedTypes.length === 0) return

  // If no capacity at all, remove carried units without fleet pool fallback,
  // leave those with FLEET_POOL_COST for fleet pool to handle
  if (totalCapacity === 0) {
    for (const { baseType, hasFleetPool } of carriedTypes) {
      if (hasFleetPool) continue
      const units = api.getUnits(baseType, { includeVariants: true })
      for (const unitId of units) {
        api.removeUnit(unitId)
      }
    }
    return
  }

  // Compute total cost
  let totalCost = 0
  for (const { baseType, cost } of carriedTypes) {
    totalCost += cost * api.countUnits(baseType, { includeVariants: true })
  }

  if (totalCost <= totalCapacity) return

  // Remove excess units by priority, but skip those with fleet pool fallback
  let excess = totalCost - totalCapacity

  for (const priorityType of removePriority) {
    if (excess <= 0) break

    const { type: baseType } = parseVariantId(priorityType)
    const info = carriedTypes.find(
      c => c.baseType === baseType || c.baseType === priorityType,
    )
    if (!info || info.hasFleetPool) continue
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST == null) continue

    while (excess > 0) {
      const units = api.getUnits(priorityType)
      if (units.length === 0) break
      api.removeUnit(units[0])
      excess -= stats.CAPACITY_COST
    }
  }
}

export const capacity: Ability<Params> = {
  key: 'CAPACITY',
  name: 'Enforce Capacity',
  category: 'GENERAL',
  context: 'SPACE',
  paramsSchema: z.object({
    removePriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    removePriority: DEFAULT_PRIORITY as UnitType[],
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        enforceCapacity(ctx, params.removePriority)
      },
    },
    {
      timing: 'AFTER_ASSIGN_HITS_STEP',
      context: 'SPACE_CANNON_OFFENSE',
      call: (ctx, params) => {
        enforceCapacity(ctx, params.removePriority)
      },
    },
    {
      timing: 'END_OF_COMBAT',
      context: 'SPACE_COMBAT',
      call: (ctx, params) => {
        enforceCapacity(ctx, params.removePriority)
      },
    },
  ],
  uiConfig: ctx => {
    const carriedBaseTypes = UNIT_TYPES.filter(t => {
      const stats = ctx.api.own.getUnitStats(t)
      return stats?.CAPACITY_COST != null
    })

    return [
      {
        key: 'removePriority' as const,
        label: 'Removal Priority',
        type: 'order-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          include: carriedBaseTypes,
          includeNonParticipating: true,
        }),
      },
    ]
  },
}
