import type { Ability } from '../../../combat/abilities/types'

export const arcSecundus: Ability = {
  key: 'ARC_SECUNDUS',
  name: 'Arc Secundus',
  category: 'FACTION',
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
        ctx.api.own.modifyUnit(ctx.getUnit(), {
          isDamaged: false,
        })
      },
    },
  ],
}
