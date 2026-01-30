import type { UnitAbilityKey } from '@/types'

import type { Ability } from '../../types'

type Params = {
  isEnabled: boolean
}

const UNIT_ABILITIES: UnitAbilityKey[] = [
  'AFB',
  'BOMBARDMENT',
  'SPACE_CANNON',
  'SUSTAIN_DAMAGE',
  'PLANETARY_SHIELD',
]

export const entropicScar: Ability<Params> = {
  key: 'ENTROPIC_SCAR',
  name: 'Entropic Scar',
  category: 'ENVIRONMENT',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.own.setUnitAbilityCannotBeUsed(ability, 'ENTROPIC_SCAR')
          ctx.api.opponent.setUnitAbilityCannotBeUsed(ability, 'ENTROPIC_SCAR')
        }
      },
    },
  ],
}
