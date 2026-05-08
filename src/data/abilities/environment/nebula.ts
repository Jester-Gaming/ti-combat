import type { Ability } from '../../../combat/abilities-engine/types'

export const nebula: Ability = {
  key: 'NEBULA',
  name: 'Nebula',
  description:
    'If a space combat occurs in a nebula, the defender applies +1 to each combat roll of their ships during that combat.',
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
