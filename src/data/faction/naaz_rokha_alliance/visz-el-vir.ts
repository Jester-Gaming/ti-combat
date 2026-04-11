import type { Ability } from '../../../combat/abilities-engine/types'

export const viszElVir: Ability = {
  key: 'VISZ_EL_VIR',
  name: 'Visz El Vir',
  description: 'Your mechs in this system roll 1 additional die during combat.',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, _params, dice) => {
        for (const id of ctx.api.own.getUnits('MECH', {
          includeVariants: true,
        })) {
          dice.own.addDiceCount(1, id)
        }
      },
    },
  ],
}
