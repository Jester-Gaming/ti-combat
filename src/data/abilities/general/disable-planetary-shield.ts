import type { Ability } from '../../../combat/abilities-engine/types'

export const disablePlanetaryShield: Ability = {
  key: 'DISABLE_PLANETARY_SHIELD',
  name: 'Disable Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'WAR_SUN')
      },
    },
  ],
}
