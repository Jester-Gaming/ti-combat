import type { Ability } from '../../../combat/abilities-engine/types'

export const l4Disruptors: Ability = {
  key: 'L4_DISRUPTORS',
  name: 'L4 Disruptors',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'L4_DISRUPTORS',
        )
      },
    },
    {
      timing: 'CLEANUP',
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          'L4_DISRUPTORS',
        )
      },
    },
  ],
}
