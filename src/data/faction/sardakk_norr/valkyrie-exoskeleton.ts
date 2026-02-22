import type { Ability } from '@/combat/abilities-engine/types'

export const valkyrieExoskeleton: Ability = {
  key: 'VALKYRIE_EXOSKELETON',
  name: 'Valkyrie Exoskeleton',
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      side: 'OWN',
      isCallable: (_params, ctx, unitId) => {
        return unitId === ctx.getUnit()
      },
      call: ctx => {
        ctx.api.opponent.addHits(1, [])
      },
    },
  ],
}
