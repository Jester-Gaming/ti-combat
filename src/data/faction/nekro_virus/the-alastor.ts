import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

export const theAlastor: Ability = {
  key: 'THE_ALASTOR',
  name: 'The Alastor',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [
    { key: 'ships', value: 'MECH' },
    { key: 'ships', value: 'INFANTRY' },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          ships: (current: UnitType[]) => [...current, 'MECH', 'INFANTRY'],
        })
      },
    },
  ],
}
