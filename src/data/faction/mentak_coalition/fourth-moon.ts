import type { Ability } from '../../../combat/abilities/types'

export const fourthMoon: Ability = {
  key: 'FOURTH_MOON',
  name: 'Fourth Moon',
  category: 'FACTION',
  context: 'SPACE',
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
