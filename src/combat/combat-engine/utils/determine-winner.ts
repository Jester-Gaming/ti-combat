import type { CombatSide, UnitBaseType, UnitId, UnitType } from '@/types'

import { parseVariantId } from '../../utils/unit-variant'
import type { RelativeOutcome } from './types'

/**
 * Determine the winner from compact state by checking
 * if either side has participating units remaining.
 */
export function determineWinner(outcome: RelativeOutcome): CombatSide | 'draw' {
  const hasAttacker = hasParticipatingUnits(
    outcome.attackerData.units,
    outcome.attackerParticipating,
  )
  const hasDefender = hasParticipatingUnits(
    outcome.defenderData.units,
    outcome.defenderParticipating,
  )

  if (hasAttacker && !hasDefender) return 'attacker'
  if (hasDefender && !hasAttacker) return 'defender'

  return 'draw'
}

function hasParticipatingUnits(
  units: Record<string, UnitId[]>,
  participating: ReadonlySet<UnitBaseType>,
): boolean {
  for (const key in units) {
    if (!units[key] || units[key].length <= 0) continue
    const { type } = parseVariantId(key as UnitType)
    if (participating.has(type)) return true
  }
  return false
}
