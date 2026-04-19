import type { UnitBaseType } from '@/types'

import type { SideApi } from '../../../combat/abilities-engine/api/ability-api'
import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  fleetPool: number
  shipPriority: string[]
}

declare global {
  interface AbilityConfigMap {
    FLEET_POOL: Params
  }
}

export function enforceFleetPool(api: SideApi): void {
  const config = api.getAbilityConfig('FLEET_POOL')
  if (!config?.isEnabled) return

  const { fleetPool, shipPriority } = config

  const capacityConfig = api.getAbilityConfig('CAPACITY')
  const capacityEnabled = !!capacityConfig?.isEnabled

  // Compute total capacity if capacity is enabled
  let totalCapacity = Infinity
  if (capacityEnabled) {
    totalCapacity = 0
    const settings = api.getAbilityConfig('SETTINGS')
    const allTypes = [
      ...settings.ships,
      ...settings.groundForces,
      ...settings.structures,
    ]
    for (const baseType of allTypes) {
      const stats = api.getUnitStats(baseType)
      if (!stats || stats.CAPACITY_COST != null) continue
      const cap = stats.CAPACITY
      if (cap != null && cap > 0) {
        totalCapacity +=
          cap * api.countUnits(baseType, { includeVariants: true })
      }
    }
  }

  // Compute capacity used by units WITHOUT fleet pool fallback
  let capacityUsedByNonFP = 0
  if (totalCapacity !== Infinity) {
    const settings = api.getAbilityConfig('SETTINGS')
    const allTypes = [
      ...settings.ships,
      ...settings.groundForces,
      ...settings.structures,
    ]
    for (const baseType of allTypes) {
      const stats = api.getUnitStats(baseType)
      if (
        !stats ||
        stats.CAPACITY_COST == null ||
        typeof stats.FLEET_POOL_COST === 'number'
      )
        continue
      capacityUsedByNonFP +=
        stats.CAPACITY_COST *
        api.countUnits(baseType, { includeVariants: true })
    }
  }

  const remainingCapacity = Math.max(0, totalCapacity - capacityUsedByNonFP)

  // Sum fleet pool cost across all units using FLEET_POOL_COST stat
  let totalCost = 0
  const activeTypes = api.getActiveBaseTypes()
  for (const baseType of activeTypes) {
    const stats = api.getUnitStats(baseType)
    if (typeof stats?.FLEET_POOL_COST !== 'number') continue

    const count = api.countUnits(baseType, { includeVariants: true })

    if (stats.CAPACITY_COST != null) {
      // Unit has both costs — only excess beyond capacity counts
      // Capacity disabled = infinite → no excess → skip
      if (!capacityEnabled) continue
      const carriedCost = stats.CAPACITY_COST * count
      const excessCost = Math.max(0, carriedCost - remainingCapacity)
      const excessCount = Math.ceil(excessCost / stats.CAPACITY_COST)
      totalCost += excessCount * stats.FLEET_POOL_COST
    } else {
      totalCost += count * stats.FLEET_POOL_COST
    }
  }

  let excess = totalCost - fleetPool
  if (excess <= 0) return

  // Build removal order: unlisted types with cost first, then listed in reverse priority
  const prioritySet = new Set(shipPriority)
  const typesWithCost = activeTypes.filter(t => {
    const stats = api.getUnitStats(t)
    return typeof stats?.FLEET_POOL_COST === 'number'
  })
  const unlisted = typesWithCost.filter(t => !prioritySet.has(t))
  const removalOrder = [
    ...unlisted,
    ...[...shipPriority]
      .reverse()
      .filter(t => typesWithCost.includes(t as UnitBaseType)),
  ]

  for (const type of removalOrder) {
    if (excess <= 0) break
    const stats = api.getUnitStats(type)
    if (typeof stats?.FLEET_POOL_COST !== 'number') continue
    const cost = stats.FLEET_POOL_COST
    const unitCount = api.countUnits(type as UnitBaseType, {
      includeVariants: true,
    })
    const toRemove = Math.min(Math.ceil(excess / cost), unitCount)
    for (let i = 0; i < toRemove; i++) {
      api.removeUnits(type as UnitBaseType)
      excess -= cost
    }
  }
}

export const fleetPool: Ability<Params> = {
  key: 'FLEET_POOL',
  name: 'Enforce Fleet Pool',
  category: 'ADVANCED',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    fleetPool: 8,
    shipPriority: declareParam({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'own',
      sort: 'desc',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        enforceFleetPool(ctx.api.own)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'fleetPool' as const,
      label: 'Fleet Pool',
      type: 'number' as const,
      min: 1,
      max: 20,
    },
    {
      key: 'shipPriority' as const,
      label: 'Ship Keep Priority',
      type: 'order-list' as const,
      items: ctx.api.own.getUnitVariantsOptions({
        combatMode: 'SPACE',
      }),
    },
  ],
}
