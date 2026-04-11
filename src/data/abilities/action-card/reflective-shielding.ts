import type { Ability } from '../../../combat/abilities-engine/types'

export const reflectiveShielding: Ability = {
  key: 'REFLECTIVE_SHIELDING',
  name: 'Reflective Shielding',
  description:
    "When one of your ships uses Sustain Damage during combat: Produce 2 hits against your opponent's ships in the active system.",
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
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx, unitId) => {
        // Only trigger for ships — not mechs or ground forces
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const ships = settings?.ships ?? []
        for (const shipType of ships) {
          if (
            ctx.api.own
              .getUnits(shipType, { includeVariants: true })
              .includes(unitId)
          )
            return true
        }
        return false
      },
      call: ctx => {
        ctx.api.opponent.addHits(2, [])
      },
    },
  ],
}
