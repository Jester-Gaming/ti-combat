import type { Ability } from '../../../combat/abilities/types'

export const fighterPrototype: Ability = {
  key: 'FIGHTER_PROTOTYPE',
  name: 'Fighter Prototype',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.modifyHitValue(-2, 'FIGHTER')
      },
    },
  ],
}
