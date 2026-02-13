import type { UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

export const shieldPaling: Ability = {
  key: 'SHIELD_PALING',
  name: 'Shield Paling',
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
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
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: (current: UnitType[] = []) => [...current, 'INFANTRY'],
        })
      },
    },
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx) => !ctx.api.own.hasUnit('MECH'),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: (current: UnitType[] = []) =>
            current.filter(u => u !== 'INFANTRY'),
        })
      },
    },
  ],
}
