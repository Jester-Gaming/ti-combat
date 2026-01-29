import type { Ability, AbilityReadContext } from '../../combat/abilities/types'

export const disablePlanetaryShield: Ability = {
  key: 'DISABLE_PLANETARY_SHIELD',
  name: 'Disable Planetary Shield',
  category: 'GENERAL',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (_params: Record<string, unknown>, ctx: AbilityReadContext) =>
        ctx.api.own.hasUnit('WAR_SUN'),
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'WAR_SUN')
      },
    },
  ],
}
