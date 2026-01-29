import type { UnitAbilityKey } from '@/types'

import { setUnitAbilityCannotBeUsed } from '../../../state/side-state-ops'
import type { Ability, AbilityReadContext, StateChange } from '../../types'

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
  enableUI: true,
  condition: { onlyDefender: true },
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (_: AbilityReadContext, params: Params) => params.isEnabled,
      call: (ctx: AbilityReadContext): StateChange<void> => {
        let state = ctx.state
        for (const ability of UNIT_ABILITIES) {
          state = setUnitAbilityCannotBeUsed(
            state,
            'attacker',
            ability,
            'ENTROPIC_SCAR',
          )
          state = setUnitAbilityCannotBeUsed(
            state,
            'defender',
            ability,
            'ENTROPIC_SCAR',
          )
        }
        return { state }
      },
    },
  ],
}
