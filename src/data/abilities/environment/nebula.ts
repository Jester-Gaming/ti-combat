import type { Ability } from '../../../combat/abilities-engine/types'

export const nebula: Ability = {
  key: 'NEBULA',
  name: 'Nebula',
  category: 'ENVIRONMENT',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  side: 'defender',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}
