import type { UnitType, UnitStats } from '@/types'
import type { CombatState, CombatSideState, Unit } from '../types'

export function createInitialCombatState(
  attackerStats: Partial<Record<UnitType, UnitStats>>,
  attackerCounts: Partial<Record<UnitType, number>>,
  defenderStats: Partial<Record<UnitType, UnitStats>>,
  defenderCounts: Partial<Record<UnitType, number>>,
): CombatState {
  return {
    attacker: createSideState(attackerStats, attackerCounts),
    defender: createSideState(defenderStats, defenderCounts),
  }
}

function createSideState(
  stats: Partial<Record<UnitType, UnitStats>>,
  counts: Partial<Record<UnitType, number>>,
): CombatSideState {
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, count] of Object.entries(counts)) {
    if (count && count > 0) {
      units[type as UnitType] = Array.from({ length: count }, () => ({}))
    }
  }

  return { stats, units, pendingHits: 0 }
}
