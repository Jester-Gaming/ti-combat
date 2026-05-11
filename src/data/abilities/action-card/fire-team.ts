import type { Ability } from '../../../combat/abilities-engine/types'

export const fireTeam: Ability = {
  key: 'FIRE_TEAM',
  name: 'Fire Team',
  description:
    'After your ground forces make combat rolls during a round of ground combat: Reroll any number of your dice.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      call: ctx => {
        ctx.api.own.reroll({ target: 'MISSES' })
      },
    },
  ],
}
