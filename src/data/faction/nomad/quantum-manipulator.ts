import type { Ability } from '@/combat'

export const quantumManipulator: Ability = {
  key: 'QUANTUM_MANIPULATOR',
  name: 'Quantum Manipulator',
  description:
    'While this unit is in a space area during combat, you may use its Sustain Damage ability to cancel a hit that is produced against your ships in this system.',
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
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() <= 0) return false
        const unitId = ctx.getUnit()
        if (ctx.api.own.getUnitState(unitId)?.isDamaged) return false
        const unitType = ctx.api.own.getUnitBaseType(unitId)!
        if (
          ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType) ||
          ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)
        ) {
          return false
        }
        return true
      },
      call: ctx => {
        const locator = ctx.getUnit()
        ctx.api.own.modifyUnitState(locator, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.logger?.log(ctx.api.own.getUnitBaseType(ctx.getUnit()))
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', locator)
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', locator)
      },
    },
  ],
}
