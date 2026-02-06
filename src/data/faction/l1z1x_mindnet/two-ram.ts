import type { Ability } from '../../../combat/abilities/types'

export const twoRam: Ability = {
  key: 'TWO_RAM',
  name: '(L1z1x) 2RAM',
  category: 'COMMANDER',
  context: 'GROUND',
  side: 'attacker',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', 'TWO_RAM')
      },
    },
  ],
}
