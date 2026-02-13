import type { Ability } from '../../../combat/abilities/types'

export const mollTerminus: Ability = {
  key: 'MOLL_TERMINUS',
  name: 'Moll Terminus',
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
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
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'BOMBARDMENT',
      always: true,
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          'MOLL_TERMINUS',
        )
      },
    },
    {
      timing: 'AFTER_ASSIGN_HITS_STEP',
      context: 'BOMBARDMENT',
      always: true,
      call: ctx => {
        if (ctx.api.own.hasUnit('MECH')) {
          ctx.api.opponent.setUnitAbilityCannotBeUsed(
            'SUSTAIN_DAMAGE',
            'MOLL_TERMINUS',
          )
        }
      },
    },
    {
      timing: 'AFTER_DESTROY',
      call: ctx => {
        if (!ctx.api.own.hasUnit('MECH')) {
          ctx.api.opponent.removeUnitAbilityCannotBeUsed(
            'SUSTAIN_DAMAGE',
            'MOLL_TERMINUS',
          )
        }
      },
    },
  ],
}
