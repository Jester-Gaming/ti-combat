import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities/types'
import { getUnitLocator } from '../../../combat/utils/compact-units'
import {
  parseVariantId,
  unitMatchesVariant,
} from '../../../combat/utils/unit-variant'

function findVoidShieldTarget(ctx: AbilityReadContext) {
  const sustainConfig = ctx.api.own.getAbilityConfig('SUSTAIN_DAMAGE')
  const priority = (sustainConfig?.spacePriority as string[]) ?? []

  const validTargets = ctx.api.own.getHitPoolValidTargets()
  const validTargetSet = validTargets.length > 0 ? new Set(validTargets) : null

  for (const variantId of priority) {
    const { type: unitType } = parseVariantId(variantId)
    if (validTargetSet && !validTargetSet.has(unitType)) continue
    if (ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)) {
      continue
    }

    const units = ctx.api.own.getUnits(unitType)
    for (const unit of units) {
      if (!unitMatchesVariant(unit, variantId)) continue
      if (unit.isDamaged) continue
      // Skip units with active native sustain — they use their own ability
      if (
        unit.UNIT_ABILITIES?.SUSTAIN_DAMAGE &&
        !ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType)
      ) {
        continue
      }
      return { unit, unitType }
    }
  }

  return undefined
}

export const metaliVoidShielding: Ability = {
  key: 'METALI_VOID_SHIELDING',
  name: 'Metali Void Shielding',
  category: 'RELIC',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() <= 0) return false
        return findVoidShieldTarget(ctx) !== undefined
      },
      call: ctx => {
        const target = findVoidShieldTarget(ctx)
        if (!target) return

        const locator = getUnitLocator(target.unit)!
        ctx.api.own.modifyUnit(locator, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.log(target.unitType)
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', locator)
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', locator)
      },
    },
  ],
}
