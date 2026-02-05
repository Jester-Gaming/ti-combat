import type { Ability } from '@/combat/abilities/types'
import type { Unit } from '@/types'

type Params = {
  isEnabled: boolean
}

export const valkyrieExoskeleton: Ability<Params> = {
  key: 'VALKYRIE_EXOSKELETON',
  name: 'Valkyrie Exoskeleton',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'GROUND',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
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
