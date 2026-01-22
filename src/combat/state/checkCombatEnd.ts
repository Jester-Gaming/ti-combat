import type { CombatState, CombatSideState } from '../types'

function countUnits(side: CombatSideState): number {
  let total = 0
  for (const units of Object.values(side.units)) {
    if (units) total += units.length
  }
  return total
}

export function checkCombatEnd(state: CombatState): boolean {
  const attackerAlive = countUnits(state.attacker) > 0
  const defenderAlive = countUnits(state.defender) > 0

  if (attackerAlive && defenderAlive) {
    return false
  }

  return true
}
