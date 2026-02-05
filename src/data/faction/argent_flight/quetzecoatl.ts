import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const quetzecoatl: Ability<Params> = {
  key: 'QUETZECOATL',
  name: 'Quetzecoatl',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  params: {
    isEnabled: true,
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
