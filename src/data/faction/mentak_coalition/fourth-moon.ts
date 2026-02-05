import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const fourthMoon: Ability<Params> = {
  key: 'FOURTH_MOON',
  name: 'Fourth Moon',
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
          'SUSTAIN_DAMAGE',
          'FOURTH_MOON',
        )
      },
    },
    {
      timing: 'AFTER_DESTROY',
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          'FOURTH_MOON',
        )
      },
    },
  ],
}
