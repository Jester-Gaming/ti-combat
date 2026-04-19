import type {
  Ability,
  AbilityReadContext,
} from '../../../combat/abilities-engine/types'
import { parseVariantId } from '../../../combat/utils/unit-variant'
import type { UnitId } from '../../../types'

export const metaliVoidShielding: Ability = {
  key: 'METALI_VOID_SHIELDING',
  name: 'Metali Void Shielding',
  description:
    'Each time hits are produced against 1 or more of your non-fighter ships, 1 of those ships may use Sustain Damage as if it had that ability.',
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

        ctx.api.own.modifyUnitState(target, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.logger?.log(ctx.api.own.getUnitVariant(target))
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', target)
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', target)
      },
    },
  ],
}

function findVoidShieldTarget(ctx: AbilityReadContext): UnitId | undefined {
  const sustainConfig = ctx.api.own.getAbilityConfig('SUSTAIN_DAMAGE')
  const priority = sustainConfig?.spacePriority ?? []

  const validTargets = ctx.api.own.getHitPoolValidTargets()
  const validTargetSet = validTargets.length > 0 ? new Set(validTargets) : null

  for (const variantId of priority) {
    const { type: unitType } = parseVariantId(variantId)
    if (validTargetSet && !validTargetSet.has(unitType)) continue
    if (ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', unitType)) {
      continue
    }

    const units = ctx.api.own.getUnits(variantId)
    if (units.length === 0) continue

    // Ignore units that don't have sustain because it lost
    if (ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', unitType)) {
      continue
    }

    for (const unitId of units) {
      if (ctx.api.own.getUnitState(unitId)?.isDamaged) continue
      return unitId
    }
  }

  return undefined
}
