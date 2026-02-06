import type { Ability } from '../../../combat/abilities/types'

export const mollTerminus: Ability = {
  key: 'MOLL_TERMINUS',
  name: 'Moll Terminus',
  category: 'FACTION',
  subcategory: 'UNIT',
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
          'MOLL_TERMINUS',
        )
      },
    },
    {
      timing: 'AFTER_DESTROY',
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          'MOLL_TERMINUS',
        )
      },
    },
  ],
}
