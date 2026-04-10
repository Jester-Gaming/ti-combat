import { z } from 'zod/mini'

import { type Ability } from '@/combat'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

type Params = {
  strategy: 'IMMEDIATELY' | 'ENOUGH_FLEET_POOL'
  ships: Record<string, number>
}

const ALLOWED_TYPES: UnitBaseType[] = ['FLAGSHIP', 'CRUISER', 'DESTROYER']

function getShipsToPlace(ships: Record<string, number>) {
  const toPlace: Partial<Record<UnitBaseType, number>> = {}
  const flagship = Math.min(ships.FLAGSHIP ?? 0, 1)
  if (flagship > 0) toPlace.FLAGSHIP = flagship

  const cruisers = ships.CRUISER ?? 0
  const destroyers = ships.DESTROYER ?? 0
  let remaining = 2
  const clampedCruisers = Math.min(cruisers, remaining)
  remaining -= clampedCruisers
  const clampedDestroyers = Math.min(destroyers, remaining)

  if (clampedCruisers > 0) toPlace.CRUISER = clampedCruisers
  if (clampedDestroyers > 0) toPlace.DESTROYER = clampedDestroyers

  return toPlace
}

export const overwingZeta: Ability<Params> = {
  key: 'OVERWING_ZETA',
  name: 'Overwing Zeta',
  category: 'FACTION',
  subcategory: 'HERO',
  context: 'SPACE',
  paramsSchema: z.object({
    strategy: z.string(),
    ships: z.record(z.string(), z.number()),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    strategy: 'IMMEDIATELY',
    ships: {},
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const toPlace = getShipsToPlace(params.ships)
        if (Object.keys(toPlace).length === 0) return false

        if (params.strategy === 'ENOUGH_FLEET_POOL') {
          const config = ctx.api.own.getAbilityConfig('FLEET_POOL')
          if (!config?.isEnabled) return true
          const fleetPool = config.fleetPool as number

          // Sum current fleet pool cost
          let currentCost = 0
          for (const baseType of ctx.api.own.getActiveBaseTypes()) {
            const stats = ctx.api.own.getUnitStats(baseType)
            if (typeof stats?.FLEET_POOL_COST !== 'number') continue
            const count = ctx.api.own.countUnits(baseType, {
              includeVariants: true,
            })
            currentCost += count * stats.FLEET_POOL_COST
          }

          // Sum cost of ships to place
          let addingCost = 0
          for (const [type, n] of Object.entries(toPlace)) {
            const stats = ctx.api.own.getUnitStats(type)
            if (typeof stats?.FLEET_POOL_COST === 'number') {
              addingCost += n * stats.FLEET_POOL_COST
            }
          }

          return currentCost + addingCost <= fleetPool
        }

        return true
      },
      call: (ctx, params) => {
        const toPlace = getShipsToPlace(params.ships)
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: () => [
    {
      key: 'strategy' as const,
      label: 'Strategy',
      type: 'select' as const,
      items: [
        { label: 'Immediately (R1)', value: 'IMMEDIATELY' },
        { label: 'Enough Fleet Pool', value: 'ENOUGH_FLEET_POOL' },
      ],
    },
    {
      key: 'ships' as const,
      label: 'Ships',
      type: 'number-list' as const,
      items: ALLOWED_TYPES.map(type => ({
        label: UNIT_DISPLAY_NAMES[type],
        value: type,
        max: type === 'FLAGSHIP' ? 1 : 2,
      })),
    },
  ],
}
