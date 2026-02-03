import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const publicizeWeaponSchematics: Ability<Params> = {
  key: 'PUBLICIZE_WEAPON_SCHEMATICS',
  name: 'Publicize Weapon Schematics',
  category: 'AGENDA',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  condition: {
    onlyDefender: true,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
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
