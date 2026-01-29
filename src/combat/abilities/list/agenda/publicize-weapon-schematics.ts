import { setUnitAbilityLost } from '../../../state/side-state-ops'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

type Params = {
  isEnabled: boolean
}

export const publicizeWeaponSchematics: Ability<Params> = {
  key: 'PUBLICIZE_WEAPON_SCHEMATICS',
  name: 'Publicize Weapon Schematics',
  category: 'AGENDA',
  defaultParams: {
    isEnabled: false,
  },
  condition: {
    onlyDefender: true,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (_ctx: AbilityReadContext, params: Params) =>
        params.isEnabled,
      call: (ctx: AbilityReadContext): StateChange<void> => {
        let state = setUnitAbilityLost(
          ctx.state,
          'attacker',
          'SUSTAIN_DAMAGE',
          'PUBLICIZE_WEAPON_SCHEMATICS',
          'WAR_SUN',
        )
        state = setUnitAbilityLost(
          state,
          'defender',
          'SUSTAIN_DAMAGE',
          'PUBLICIZE_WEAPON_SCHEMATICS',
          'WAR_SUN',
        )
        return { state }
      },
    },
  ],
}
