import type { Ability } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const mollTerminus: Ability<Params> = {
  key: 'MOLL_TERMINUS',
  name: 'Moll Terminus',
  category: 'FACTION',
  subcategory: 'UNIT',
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
