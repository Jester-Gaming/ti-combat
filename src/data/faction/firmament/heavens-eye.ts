import type { Ability } from '../../../combat/abilities-engine/types'

export const heavensEye: Ability = {
  key: 'HEAVENS_EYE',
  name: "Heaven's Eye",
  description:
    'Repair this ship at the end of every combat round if the active system contains units that belong to a player who has a control token on 1 of your plots.',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      call: ctx => {
        const unitId = ctx.getUnit()
        ctx.api.own.modifyUnitState(unitId, { isDamaged: false })
        ctx.api.own.enableUnitAbility(unitId, 'SUSTAIN_DAMAGE')
      },
    },
  ],
}
