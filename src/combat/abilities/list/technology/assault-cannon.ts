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

export const assaultCannon: Ability<Params> = {
  key: 'ASSAULT_CANNON',
  name: 'Assault Cannon',
  category: 'TECHNOLOGY',
  context: 'SPACE',
  defaultParams: {
    isEnabled: false,
    targetPriority: NON_FIGHTER_SHIPS.toReversed(),
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
        const target = ctx.api.opponent.findUnitByPriority(
          params.targetPriority,
        )
        return target !== undefined
      },
      call: (ctx, params: Params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          params.targetPriority,
        )

        if (!target) return

        ctx.api.opponent.destroyUnit(target)
      },
    },
  ],
  uiConfig: ctx => {
    const variants = ctx.api.opponent.getParticipatingVariants({
      combatMode: 'SPACE',
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
