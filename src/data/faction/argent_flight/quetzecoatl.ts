import type { Ability } from '../../../combat/abilities/types'

export const quetzecoatl: Ability = {
  key: 'QUETZECOATL',
  name: 'Quetzecoatl',
  category: 'FACTION',
  invoke: [
    {
      timing: 'PREPARE_SPACE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'QUETZECOATL',
        )
      },
    },
  ],
}
