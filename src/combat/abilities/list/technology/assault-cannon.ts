import { getVariantDisplayName } from '@/combat/utils/unit-variant'
import { NON_FIGHTER_SHIPS } from '@/constants/units'
import { type UnitType } from '@/types'

import type { Ability, SideReadApi } from '../../types'

type Params = {
  isEnabled: boolean
  targetPriority: UnitType[]
}

/** Count non-fighter ships on a side */
function countNonFighterShips(api: SideReadApi): number {
  let count = 0
  const units = api.getUnits()
  for (const [unitType, typeUnits] of Object.entries(units)) {
    if (unitType === 'FIGHTER') continue
    if (typeUnits && typeUnits.length > 0) {
      count += typeUnits.length
    }
  }
  return count
}

/** Find the first available target from priority list */
function findTarget(
  opponentApi: SideReadApi,
  priority: UnitType[],
): UnitType | null {
  for (const unitType of priority) {
    if (unitType === 'FIGHTER') continue
    if (opponentApi.hasUnit(unitType)) {
      return unitType
    }
  }
  return null
}

export const assaultCannon: Ability<Params> = {
  key: 'ASSAULT_CANNON',
  name: 'Assault Cannon',
  category: 'TECHNOLOGY',
  defaultParams: {
    isEnabled: false,
    targetPriority: [...NON_FIGHTER_SHIPS].reverse(),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.isEnabled) return false

        // Must have at least 3 non-fighter ships
        const nonFighterCount = countNonFighterShips(ctx.api.own)
        if (nonFighterCount < 3) return false

        // Must have a valid target in opponent's units
        const target = findTarget(ctx.api.opponent, params.targetPriority)
        return target !== null
      },
      call: (ctx, params: Params) => {
        const targetType = findTarget(ctx.api.opponent, params.targetPriority)
        if (!targetType) return

        ctx.api.opponent.destroyUnit(targetType)
      },
    },
  ],
  uiConfig: ctx => {
    const variants = ctx.api.opponent.getParticipatingVariants({
      exclude: ['FIGHTER'],
    })
    const items = variants.map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))

    return [
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'order-list' as const,
        items,
      },
    ]
  },
}
