import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const viszElVir: Ability<Params> = {
  key: 'VISZ_EL_VIR',
  name: 'Visz El Vir',
  category: 'FACTION',
  subcategory: 'UNIT',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, _params: Params, dice: DiceContext) => {
        const mechs = ctx.api.own.getUnits('MECH')
        for (const mech of mechs) {
          dice.own.addDice(1, mech)
        }
      },
    },
  ],
}
