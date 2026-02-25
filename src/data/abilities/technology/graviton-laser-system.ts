import type { Ability } from '../../../combat/abilities-engine/types'

export const gravitonLaserSystem: Ability = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  category: 'TECHNOLOGY',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      call: ctx => {
        const { nonFighterShips } =
          ctx.api.opponent.getAbilityConfig('SETTINGS')
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsSpaceCannonOffense: nonFighterShips,
        })
      },
    },
  ],
}
