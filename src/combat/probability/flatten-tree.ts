import type { CombatSide, UnitBaseType, UnitId, UnitState } from '@/types'

import type { SideStateData } from '../combat-state/types'
import type { SurvivorSide } from '../types'
import { parseVariantId } from '../utils/unit-variant'

/**
 * Outcome with probability relative to reaching the node.
 * Stores compact state references instead of extracted survivors —
 * extraction is deferred to outcomeRecordToArray (once per unique outcome).
 */
export interface RelativeOutcome {
  attackerData: SideStateData
  defenderData: SideStateData
  attackerParticipating: ReadonlySet<UnitBaseType>
  defenderParticipating: ReadonlySet<UnitBaseType>
  probability: number
}

export type OutcomeRecord = Map<string, RelativeOutcome>

/**
 * Generate a unique outcome key directly from compact state.
 * Avoids creating intermediate SurvivorUnit objects.
 */
export function generateCompactOutcomeKey(
  attackerData: SideStateData,
  defenderData: SideStateData,
  attackerParticipating: ReadonlySet<UnitBaseType>,
  defenderParticipating: ReadonlySet<UnitBaseType>,
): string {
  return `${formatCompactSideKey(attackerData.units, attackerData.unitState, attackerParticipating)}|${formatCompactSideKey(defenderData.units, defenderData.unitState, defenderParticipating)}`
}

function formatCompactSideKey(
  units: Record<string, UnitId[]>,
  unitState: Record<number, UnitState>,
  participating: ReadonlySet<UnitBaseType>,
): string {
  const keys = Object.keys(units)
  if (keys.length === 0) return ''
  if (keys.length > 1) keys.sort()

  let result = ''
  for (const key of keys) {
    const ids = units[key]
    if (!ids || ids.length <= 0) continue
    const { type } = parseVariantId(key)
    if (!participating.has(type)) continue

    if (result) result += ','

    let damaged = 0
    for (const id of ids) {
      if (unitState[id]?.isDamaged) damaged++
    }
    if (damaged === 0) {
      result += key + ':' + ids.length
    } else {
      result += key + ':' + ids.length + 'd' + damaged
    }
  }
  return result
}

/**
 * Extract survivors from compact state, filtering by participating units.
 * Called once per unique outcome (not per leaf) for lazy extraction.
 */
export function extractSurvivors(
  sideState: SideStateData,
  participatingUnits: ReadonlySet<UnitBaseType>,
): SurvivorSide {
  const survivors: SurvivorSide = {}

  for (const key in sideState.units) {
    const ids = sideState.units[key]
    if (!ids || ids.length <= 0) continue

    const { type, subtypes } = parseVariantId(key)
    if (!participatingUnits.has(type)) continue

    if (!survivors[type]) {
      survivors[type] = []
    }

    for (const id of ids) {
      const us = sideState.unitState[id]
      survivors[type]!.push({
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
  }

  return survivors
}

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
    const { type } = parseVariantId(key)
    if (participating.has(type)) return true
  }
  return false
}
