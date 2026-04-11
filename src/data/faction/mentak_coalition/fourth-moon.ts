import type { Ability } from '../../../combat/abilities-engine/types'

export const fourthMoon: Ability = {
  key: 'FOURTH_MOON',
  name: 'Fourth Moon',
  description: "Other players' ships in this system cannot use Sustain Damage.",
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
          'SUSTAIN_DAMAGE',
          'FOURTH_MOON',
          'SHIPS',
        )
      },
    },
    {
      timing: 'DESTROY',
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          'FOURTH_MOON',
          'SHIPS',
        )
      },
    },
  ],
}
