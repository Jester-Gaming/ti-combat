import type { Ability } from '@/combat/abilities/types'
import type { UnitType } from '@/types'

export const eidolon: Ability = {
  key: 'EIDOLON',
  name: 'Eidolon',
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
          ships: (current: UnitType[]) => [...current, 'MECH'],
        })

        // Z-Grav form loses Sustain Damage
        ctx.api.own.setUnitAbilityLost('SUSTAIN_DAMAGE', 'EIDOLON', 'MECH')

        // Modify all mechs to Z-Grav form: combat [8, 2]
        const mechs = ctx.api.own.getUnits('MECH')
        for (let i = 0; i < mechs.length; i++) {
          ctx.api.own.modifyUnit(mechs[i], { COMBAT: [8, 2] })
        }
      },
    },
  ],
}
