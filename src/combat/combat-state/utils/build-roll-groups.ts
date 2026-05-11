import type { UnitId, UnitType } from '@/types'

import type { DicePool } from '../../abilities-engine/types'
import type { GroupRoll } from '../../reroll/types'
import { parseVariantId } from '../../utils/unit-variant'

interface Lookups {
  /** Variant key for this unit (e.g. 'CRUISER' or 'CRUISER:Cavalry'). */
  variantKeyOf: (id: UnitId) => string
}

/** Group a side's rolled DicePool by `(variantKey, hitValue, dicePerUnit)`.
 *  Units that share all three are mathematically interchangeable for reroll
 *  decisions — Apollo's grouping rule. Each group's `units` is a multiset
 *  (UnitIds in arbitrary order), and `hits` is left empty here; the per-unit
 *  hit counts are filled in by `_rollDice`'s per-group multiset enumeration. */
export function buildRollGroups(pool: DicePool, lk: Lookups): GroupRoll[] {
  const byKey = new Map<string, GroupRoll>()
  for (const sourcedDice of Object.values(pool)) {
    if (!sourcedDice) continue
    for (const [hitValue, baseDice, bonusDice, unitId] of sourcedDice) {
      const dicePerUnit = baseDice + bonusDice
      if (dicePerUnit === 0) continue
      const variantKey = lk.variantKeyOf(unitId)
      const key = `${variantKey}|${hitValue}|${dicePerUnit}`
      const existing = byKey.get(key)
      if (existing) {
        existing.units.push(unitId)
      } else {
        const source = parseVariantId(variantKey as UnitType).type as UnitType
        byKey.set(key, {
          source,
          variantKey,
          units: [unitId],
          dicePerUnit,
          hitValue,
          hits: [],
        })
      }
    }
  }
  return [...byKey.values()]
}
