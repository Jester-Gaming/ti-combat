import type { Ability } from '../../../combat/abilities/types'

export const reflectiveShielding: Ability = {
  key: 'REFLECTIVE_SHIELDING',
  name: 'Reflective Shielding',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      call: ctx => {
        ctx.api.opponent.addHits(2, [])
      },
    },
  ],
}
