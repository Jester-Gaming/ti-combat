import type { Ability } from '../../../combat/abilities/types'

export const disablePlanetaryShield: Ability = {
  key: 'DISABLE_PLANETARY_SHIELD',
  name: 'Disable Planetary Shield',
  category: 'GENERAL',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'WAR_SUN')
      },
    },
  ],
}
