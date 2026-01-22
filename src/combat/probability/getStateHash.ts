import type { CombatState, CombatSideState } from '../types'

function getSideHash(side: CombatSideState): string {
  const parts: string[] = []

  const sortedTypes = Object.keys(side.units).sort()

  for (const type of sortedTypes) {
    const units = side.units[type as keyof typeof side.units]
    if (!units || units.length === 0) continue

    // Serialize full unit state for ability support
    const unitStates = units.map(u => JSON.stringify(u)).join(',')
    parts.push(`${type}:[${unitStates}]`)
  }

  return parts.join(',')
}

export function getStateHash(state: CombatState): string {
  return `${getSideHash(state.attacker)}|${getSideHash(state.defender)}`
}
