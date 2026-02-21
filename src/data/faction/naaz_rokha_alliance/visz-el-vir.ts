import type { Ability } from '../../../combat/abilities/types'
import { getUnitId } from '../../../combat/utils/compact-units'

export const viszElVir: Ability = {
  key: 'VISZ_EL_VIR',
  name: 'Visz El Vir',
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
        const mechs = ctx.api.own.getUnits('MECH')
        for (const mech of mechs) {
          dice.own.addDiceCount(1, getUnitId(mech)!)
        }
      },
    },
  ],
}
