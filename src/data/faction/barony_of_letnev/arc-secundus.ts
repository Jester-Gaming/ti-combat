import type { Ability } from '../../../combat/abilities-engine/types'

export const arcSecundus: Ability = {
  key: 'ARC_SECUNDUS',
  name: 'Arc Secundus',
  description:
    "Other players' units in this system lose Planetary Shield. At the start of each space combat round, repair this ship.",
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
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'ARC_SECUNDUS')
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        const unitId = ctx.getUnit()
        ctx.api.own.modifyUnitState(unitId, {
          isDamaged: false,
        })
        ctx.api.own.enableUnitAbility(unitId, 'SUSTAIN_DAMAGE')
      },
    },
  ],
}
