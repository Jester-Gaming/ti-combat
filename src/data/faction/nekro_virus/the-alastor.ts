import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

type Params = {
  isEnabled: boolean
}

export const theAlastor: Ability<Params> = {
  key: 'THE_ALASTOR',
  name: 'The Alastor',
  category: 'FACTION',
  context: 'SPACE',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  declareParamChange: () => [
    { key: 'ships', value: 'MECH' },
    { key: 'ships', value: 'INFANTRY' },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          ships: (current: UnitType[]) => [...current, 'MECH', 'INFANTRY'],
        })
      },
    },
  ],
}
