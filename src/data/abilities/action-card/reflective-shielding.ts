import type { Unit, UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

export const reflectiveShielding: Ability = {
  key: 'REFLECTIVE_SHIELDING',
  name: 'Reflective Shielding',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (_params, ctx, unit: Unit) => {
        // Only trigger for ships — not mechs or ground forces
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const ships = (settings?.ships as UnitType[]) ?? []
        return ships.some(type => ctx.api.own.getUnits(type).includes(unit))
      },
      call: ctx => {
        ctx.api.opponent.addHits(2, [])
      },
    },
  ],
}
