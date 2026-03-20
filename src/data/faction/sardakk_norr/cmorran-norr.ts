import type { Ability } from '../../../combat/abilities-engine/types'

export const cmorranNorr: Ability = {
  key: 'CMORRAN_NORR',
  name: "C'morran N'orr",
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
      call: ctx => {
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const ships = settings?.ships ?? []
        for (const shipType of ships) {
          if (shipType === 'FLAGSHIP') continue
          ctx.api.own.modifyHitValue(-1, shipType)
        }
      },
    },
  ],
}
