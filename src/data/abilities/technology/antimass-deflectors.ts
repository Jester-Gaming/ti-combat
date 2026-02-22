import type { Ability } from '../../../combat/abilities-engine/types'

export const antimassDeflectors: Ability = {
  key: 'ANTIMASS_DEFLECTORS',
  name: 'Antimass Deflectors',
  category: 'TECHNOLOGY',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: ctx => {
        ctx.api.opponent.modifyHitValue(1)
      },
    },
  ],
}
