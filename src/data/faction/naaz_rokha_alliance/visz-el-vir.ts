import type { Ability, DiceContext } from '../../../combat/abilities/types'

export const viszElVir: Ability = {
  key: 'VISZ_EL_VIR',
  name: 'Visz El Vir',
  category: 'FACTION',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, _params: Record<string, never>, dice: DiceContext) => {
        const mechs = ctx.api.own.getUnits('MECH')
        for (const mech of mechs) {
          dice.own.addDice(1, mech)
        }
      },
    },
  ],
}
