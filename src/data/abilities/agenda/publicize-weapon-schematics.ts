import type { Ability } from '../../../combat/abilities/types'

export const publicizeWeaponSchematics: Ability = {
  key: 'PUBLICIZE_WEAPON_SCHEMATICS',
  name: 'Publicize Weapon Schematics',
  category: 'AGENDA',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  side: 'defender',
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.setUnitAbilityLost(
          'SUSTAIN_DAMAGE',
          'PUBLICIZE_WEAPON_SCHEMATICS',
          'WAR_SUN',
        )
        ctx.api.opponent.setUnitAbilityLost(
          'SUSTAIN_DAMAGE',
          'PUBLICIZE_WEAPON_SCHEMATICS',
          'WAR_SUN',
        )
      },
    },
  ],
}
