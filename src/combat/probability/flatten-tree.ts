import type { CombatSide, UnitType } from '@/types'

import type { CombatState } from '../combat-state/combat-state'
import type { SurvivorSide } from '../types'
import { parseVariantId } from '../utils/unit-variant'

/** Outcome with probability relative to reaching the node */
export interface RelativeOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: CombatSide | 'draw'
  probability: number
}

export type OutcomeRecord = Map<string, RelativeOutcome>

/**
 * Extract outcome from a combat state (leaf node).
 *
 * Winner determination considers both participating units and total units:
 * - If defender has 0 participating units and attacker has any units, attacker wins
 *   (this covers bombardment scenarios where ships eliminate all ground forces)
 * - If attacker has 0 participating units and defender has any units, defender wins
 * - If both have 0 participating units, check total units for the winner
 */
export function extractLeafOutcome(
  state: CombatState,
): Omit<RelativeOutcome, 'probability'> {
  const attackerParticipating = state.getParticipatingUnits('attacker')
  const defenderParticipating = state.getParticipatingUnits('defender')

  const attackerSurvivors = extractSurvivors(
    state.data.attacker,
    attackerParticipating,
  )
  const defenderSurvivors = extractSurvivors(
    state.data.defender,
    defenderParticipating,
  )

  const attackerParticipatingCount = countSurvivors(attackerSurvivors)
  const defenderParticipatingCount = countSurvivors(defenderSurvivors)

  return {
    attacker: attackerSurvivors,
    defender: defenderSurvivors,
    winner: determineWinner(
      attackerParticipatingCount,
      defenderParticipatingCount,
    ),
  }
}

/**
 * Generate a unique key for an outcome based on survivors.
 */
export function generateOutcomeKey(
  attacker: SurvivorSide,
  defender: SurvivorSide,
): string {
  return `${formatSideKey(attacker)}|${formatSideKey(defender)}`
}

function formatSideKey(side: SurvivorSide): string {
  const keys = Object.keys(side)
  if (keys.length === 0) return ''
  if (keys.length > 1) keys.sort()

  let result = ''
  for (const type of keys) {
    const units = side[type]
    if (!units || units.length === 0) continue

    if (result) result += ','
    result += type + ':' + units.length

    // Count damaged units without allocating a filtered array
    let damaged = 0
    let hasSubtypes = false
    for (const u of units) {
      if (u.isDamaged) damaged++
      if (u.subtypes?.length) hasSubtypes = true
    }
    if (damaged) result += 'd' + damaged
    if (hasSubtypes) {
      const allSubtypes: string[] = []
      for (const u of units) {
        if (u.subtypes) {
          for (const s of u.subtypes) allSubtypes.push(s)
        }
      }
      allSubtypes.sort()
      result += 's' + allSubtypes.join('+')
    }
  }
  return result
}

/**
 * Extract survivors from compact state, filtering by participating units.
 */
function extractSurvivors(
  sideState: {
    units: Record<string, number>
    unitState: Record<string, import('@/types').UnitState[]>
  },
  participatingUnits: ReadonlySet<UnitType>,
): SurvivorSide {
  const survivors: SurvivorSide = {}

  for (const key of Object.keys(sideState.units)) {
    const count = sideState.units[key]
    if (count <= 0) continue

    const { type, subtypes } = parseVariantId(key)
    if (!participatingUnits.has(type)) continue

    if (!survivors[type]) {
      survivors[type] = []
    }

    const stateArr = sideState.unitState[key]
    for (let i = 0; i < count; i++) {
      const us = stateArr?.[i]
      survivors[type]!.push({
        ...(us?.isDamaged ? { isDamaged: true } : {}),
        ...(subtypes.length > 0 ? { subtypes } : {}),
      })
    }
  }

  return survivors
}

/**
 * Determine the winner based on surviving unit counts.
 * Checks participating units first, falls back to total units for
 * bombardment scenarios where ships eliminate all ground forces.
 */
function determineWinner(
  participatingA: number,
  participatingD: number,
): CombatSide | 'draw' {
  if (participatingA > 0 && participatingD === 0) return 'attacker'
  if (participatingD > 0 && participatingA === 0) return 'defender'

  return 'draw'
}

/**
 * Count total survivors across all unit types.
 */
function countSurvivors(survivors: SurvivorSide): number {
  return Object.values(survivors).reduce(
    (sum, units) => sum + (units?.length ?? 0),
    0,
  )
}
