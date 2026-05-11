import type { Ability } from '../../../combat/abilities-engine/types'

export const scrambleFrequency: Ability = {
  key: 'SCRAMBLE_FREQUENCY',
  name: 'Scramble Frequency',
  description:
    'After another player makes a Bombardment, Space Cannon, or Anti-Fighter Barrage roll: That player rerolls all of their dice.',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_UNIT_ABILITY_ROLL',
      call: ctx => {
        ctx.api.opponent.reroll({ target: 'ALL' })
      },
    },
  ],
}
