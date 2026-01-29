import {
  getOpponentSide,
  setUnitAbilityLost,
} from '../../../state/side-state-ops'
import type { SideState } from '../../../state/types'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

function hasWarSun(sideState: SideState): boolean {
  const warSunUnits = sideState.units.WAR_SUN
  return !!warSunUnits && warSunUnits.length > 0
}

export const disablePlanetaryShield: Ability = {
  key: 'DISABLE_PLANETARY_SHIELD',
  name: 'Disable Planetary Shield',
  category: 'GENERAL',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (ctx: AbilityReadContext) => hasWarSun(ctx.own),
      call: (ctx: AbilityReadContext): StateChange<void> => {
        const opponentSide = getOpponentSide(ctx.side)
        const state = setUnitAbilityLost(
          ctx.state,
          opponentSide,
          'PLANETARY_SHIELD',
          'WAR_SUN',
        )
        return { state }
      },
    },
  ],
}
