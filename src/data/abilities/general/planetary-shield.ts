import type { Ability } from '../../../combat/abilities-engine/types'

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  side: 'defender',
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: (_params, ctx) => {
        const unitId = ctx.getUnit()
        const unitType = ctx.api.own.getUnitBaseType(unitId)!
        if (
          ctx.api.own.isUnitAbilityLost('PLANETARY_SHIELD', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('PLANETARY_SHIELD', unitType)
        ) {
          return false
        }
        return true
      },
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          'PLANETARY_SHIELD',
        )
      },
    },
  ],
}
