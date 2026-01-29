import type { UnitType } from '@/types'

import {
  getOpponentSide,
  isUnitAbilityCannotBeUsed,
  isUnitAbilityLost,
  setUnitAbilityCannotBeUsed,
} from '../../../state/side-state-ops'
import type { SideState } from '../../../state/types'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

/** Check if any unit on the side has an active Planetary Shield */
function hasPlanetaryShield(sideState: SideState): boolean {
  for (const [type, units] of Object.entries(sideState.units)) {
    if (!units || units.length === 0) continue
    const unitType = type as UnitType

    if (
      isUnitAbilityLost(sideState, 'PLANETARY_SHIELD', unitType) ||
      isUnitAbilityCannotBeUsed(sideState, 'PLANETARY_SHIELD', unitType)
    ) {
      continue
    }

    if (units.some(u => u.UNIT_ABILITIES?.PLANETARY_SHIELD)) {
      return true
    }
  }
  return false
}

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  category: 'GENERAL',
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (ctx: AbilityReadContext) => hasPlanetaryShield(ctx.own),
      call: (ctx: AbilityReadContext): StateChange<void> => {
        const opponentSide = getOpponentSide(ctx.side)
        const state = setUnitAbilityCannotBeUsed(
          ctx.state,
          opponentSide,
          'BOMBARDMENT',
          'PLANETARY_SHIELD',
        )
        return { state }
      },
    },
  ],
}
