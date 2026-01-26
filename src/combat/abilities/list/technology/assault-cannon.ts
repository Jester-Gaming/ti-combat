import { UNIT_TYPES, type UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import { destroyUnit, getOpponentSide } from '../../../state/side-state-ops'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

type Params = {
  isEnabled: boolean
  targetPriority: UnitType[]
}

/** Count non-fighter ships on a side */
function countNonFighterShips(ctx: AbilityReadContext): number {
  let count = 0
  for (const [unitType, units] of Object.entries(ctx.own.units)) {
    if (unitType === 'FIGHTER') continue
    if (units && units.length > 0) {
      count += units.length
    }
  }
  return count
}

/** Find the first available target from priority list */
function findTarget(
  ctx: AbilityReadContext,
  priority: UnitType[],
): UnitType | null {
  for (const unitType of priority) {
    const opponentUnits = ctx.opponent.units[unitType]
    if (opponentUnits && opponentUnits.length > 0 && unitType !== 'FIGHTER') {
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
    targetPriority: [...UNIT_TYPES],
  },
  enableUI: true,
  invoke: [
    {
      timing: 'SETUP',
      isCallable: (ctx: AbilityReadContext, params: Params) => {
        if (!params.isEnabled) return false

        // Must have at least 3 non-fighter ships
        const nonFighterCount = countNonFighterShips(ctx)
        if (nonFighterCount < 3) return false

        // Must have a valid target in opponent's units
        const target = findTarget(ctx, params.targetPriority)
        return target !== null
      },
      call: (ctx: AbilityReadContext, params: Params): StateChange<void> => {
        const targetType = findTarget(ctx, params.targetPriority)
        if (!targetType) {
          return { state: ctx.state as typeof ctx.state & object }
        }

        const opponentSide = getOpponentSide(ctx.side)

        // Destroy the first unit of the target type
        const newState = destroyUnit(
          ctx.state as typeof ctx.state & object,
          opponentSide,
          targetType,
          0,
        )

        return { state: newState }
      },
    },
  ],
  uiConfig: () => {
    // Show all possible unit types for targeting priority
    const items = getUnitListItems(UNIT_TYPES)

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
