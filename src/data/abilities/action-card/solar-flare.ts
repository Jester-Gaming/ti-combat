import type { Ability } from '../../../combat/abilities-engine/types'

export const solarFlare: Ability = {
  key: 'SOLAR_FLARE',
  name: 'Solar Flare',
  description:
    'After you activate a system: During this movement, other players cannot use Space Cannon against your ships.',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'SOLAR_FLARE',
        )
      },
    },
  ],
}
