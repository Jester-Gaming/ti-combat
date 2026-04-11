import type { Ability } from '../../../combat/abilities-engine/types'

export const mollTerminus: Ability = {
  key: 'MOLL_TERMINUS',
  name: 'Moll Terminus',
  description:
    "Other players' ground forces on this planet cannot use Sustain Damage.",
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
      timing: 'COMMIT_UNITS',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          'MOLL_TERMINUS',
        )
      },
    },
    {
      timing: 'DESTROY',
      call: ctx => {
        if (!ctx.api.own.hasUnitType('MECH')) {
          ctx.api.opponent.removeUnitAbilityCannotBeUsed(
            'SUSTAIN_DAMAGE',
            'MOLL_TERMINUS',
          )
        }
      },
    },
  ],
}
