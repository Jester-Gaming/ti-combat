import type { UnitAbility } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

const UNIT_ABILITIES: UnitAbility[] = [
  'AFB',
  'BOMBARDMENT',
  'SPACE_CANNON',
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
]

export const quietus: Ability = {
  key: 'QUIETUS',
  name: 'Quietus',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'DESTROY',
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.opponent.removeUnitAbilityCannotBeUsed(ability, 'QUIETUS')
        }
      },
    },
  ],
}
