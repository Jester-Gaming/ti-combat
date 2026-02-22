import type { Ability } from '@/combat'
import type { UnitBaseType } from '@/types'

export const eidolon: Ability = {
  key: 'EIDOLON',
  name: 'Z-Grav Eidolon',
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [{ key: 'ships', value: 'MECH' }],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          ships: (current: UnitBaseType[]) => [...current, 'MECH'],
        })

        // Z-Grav form loses Sustain Damage
        ctx.api.own.setUnitAbilityLost('SUSTAIN_DAMAGE', 'EIDOLON', 'MECH')

        // Modify all mechs to Z-Grav form: combat [8, 2]
        ctx.api.own.modifyUnitType('MECH', { COMBAT: [8, 2] })
      },
    },
  ],
}
