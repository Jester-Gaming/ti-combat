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

export const entropicScar: Ability = {
  key: 'ENTROPIC_SCAR',
  name: 'Entropic Scar',
  description:
    'All unit abilities cannot be used by or against units inside of an entropic scar.',
  category: 'ENVIRONMENT',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  sync: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.own.setUnitAbilityCannotBeUsed(ability, 'ENTROPIC_SCAR')
        }
      },
    },
  ],
}
