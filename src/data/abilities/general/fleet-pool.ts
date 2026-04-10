import type { UnitBaseType } from '@/types'

import type { SideApi } from '../../../combat/abilities-engine/api/ability-api'
import { declareParam } from '../../../combat/abilities-engine/declare-param'
import type { Ability } from '../../../combat/abilities-engine/types'

type Params = {
  isEnabled: boolean
  fleetPool: number
  shipPriority: string[]
}

export function enforceFleetPool(api: SideApi): void {
  const config = api.getAbilityConfig('FLEET_POOL')
  if (!config?.isEnabled) return

  const fleetPool = config.fleetPool as number
  const shipPriority = config.shipPriority as string[]

  // Sum fleet pool cost across all units using FLEET_POOL_COST stat
  let totalCost = 0
  const activeTypes = api.getActiveBaseTypes()
  for (const baseType of activeTypes) {
    const stats = api.getUnitStats(baseType)
    if (typeof stats?.FLEET_POOL_COST !== 'number') continue
    const count = api.countUnits(baseType, { includeVariants: true })
    totalCost += count * stats.FLEET_POOL_COST
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
      api.removeUnit(type as UnitBaseType)
      excess -= cost
    }
  }
}

export const fleetPool: Ability<Params> = {
  key: 'FLEET_POOL',
  name: 'Enforce Fleet Pool',
  category: 'GENERAL',
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
