import type { Ability } from '../../../combat/abilities/types'

export const quetzecoatl: Ability = {
  key: 'QUETZECOATL',
  name: 'Quetzecoatl',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
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
