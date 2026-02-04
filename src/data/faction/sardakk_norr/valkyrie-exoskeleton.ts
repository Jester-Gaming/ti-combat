import type { Ability } from '@/combat/abilities/types'
import type { Unit } from '@/types'

export const valkyrieExoskeleton: Ability = {
  key: 'VALKYRIE_EXOSKELETON',
  name: 'Valkyrie Exoskeleton',
  category: 'FACTION',
  context: 'GROUND',
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (_params, ctx, unit: Unit) => {
        return unit === ctx.getUnit()
      },
      call: ctx => {
        ctx.api.opponent.addHits(1, [])
      },
    },
  ],
}
