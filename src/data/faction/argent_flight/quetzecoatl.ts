import type { Ability } from '../../../combat/abilities/types'

export const quetzecoatl: Ability = {
  key: 'QUETZECOATL',
  name: 'Quetzecoatl',
  category: 'FACTION',
  context: 'SPACE',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'QUETZECOATL',
        )
      },
    },
  ],
}
