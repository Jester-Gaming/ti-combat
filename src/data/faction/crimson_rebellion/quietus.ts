import type { UnitAbility } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

const UNIT_ABILITIES: UnitAbility[] = [
  'AFB',
  'BOMBARDMENT',
  'DEPLOY',
  'SPACE_CANNON',
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
]

export const quietus: Ability = {
  key: 'QUIETUS',
  name: 'Quietus',
  description:
    "While this unit is in a system that contains an active breach, other players' units in systems with active breaches lose all of their unit abilities.",
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  allowExternal: true,
  sync: true,
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        if (ctx.isOwner()) return
        for (const ability of UNIT_ABILITIES) {
          ctx.api.own.setUnitAbilityLost(ability, 'QUIETUS')
        }
      },
    },
    {
      timing: 'DESTROY',
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.opponent.removeUnitAbilityLost(ability, 'QUIETUS')
        }
      },
    },
  ],
}
