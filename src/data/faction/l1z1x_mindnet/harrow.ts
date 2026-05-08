import type { Ability } from '@/combat'
import { UNIT_TYPES } from '@/constants/units'

export const harrow: Ability = {
  key: 'HARROW',
  name: 'Harrow',
  description:
    'At the end of each round of ground combat, your ships in the active system may use their Bombardment abilities against your opponent’s ground forces on the planet.',
  context: 'GROUND',
  side: 'attacker',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) => {
        if (
          ctx.api.opponent.countUnits(['INFANTRY', 'MECH'], {
            includeVariants: true,
          }) === 0
        )
          return false

        for (const type of UNIT_TYPES) {
          const units = ctx.api.own.getUnits(type, { includeVariants: true })
          if (units.length === 0) continue
          const stats = ctx.api.own.getUnitStats(units[0])
          if (stats?.UNIT_ABILITIES?.BOMBARDMENT) return true
        }
        return false
      },
      call: ctx => {
        ctx.resolveStep('BOMBARDMENT')
      },
    },
  ],
}
