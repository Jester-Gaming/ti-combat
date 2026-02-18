import type { Ability } from '@/combat/abilities/types'

export const quantumManipulator: Ability = {
  key: 'QUANTUM_MANIPULATOR',
  name: 'Quantum Manipulator',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() <= 0) return false
        const unit = ctx.getUnit()
        if (unit.isDamaged) return false
        const unitType = ctx.getUnitType()
        if (
          ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
        ) {
          return false
        }
        return true
      },
      call: ctx => {
        const unit = ctx.getUnit()
        ctx.api.own.modifyUnit(unit, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.log(ctx.getUnitType())
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', unit)
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', unit)
      },
    },
  ],
}
