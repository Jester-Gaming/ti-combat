import type {
  CombatMode,
  CombatPhase,
  MicroPhase,
  PhaseIdentifier,
} from './types'
import { getPhaseKey, GROUND_COMBAT_FLOW, SPACE_COMBAT_FLOW } from './types'

// ============================================================================
// LEGACY PHASE SYSTEM (kept for backward compatibility)
// ============================================================================

const PHASE_ORDER: CombatPhase[] = [
  'START_OF_ROUND',
  'AFB_ROLL',
  'AFB_ASSIGN_HITS',
  'DICE_ROLL',
  'ASSIGN_HITS',
  'END_OF_ROUND',
  'AFTER_ROUND',
]

export interface PhaseTransition {
  phase: CombatPhase
  incrementRound: boolean
}

/**
 * Get the next phase in the combat sequence.
 * AFB phases are skipped on rounds > 1.
 */
export function getNextPhase(
  currentPhase: CombatPhase,
  round: number,
): PhaseTransition {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase)

  // After AFTER_ROUND, wrap to START_OF_ROUND and increment round
  if (currentPhase === 'AFTER_ROUND') {
    return { phase: 'START_OF_ROUND', incrementRound: true }
  }

  const nextIndex = currentIndex + 1
  let nextPhase = PHASE_ORDER[nextIndex]

  // Skip AFB phases on rounds > 1
  if (
    round > 1 &&
    (nextPhase === 'AFB_ROLL' || nextPhase === 'AFB_ASSIGN_HITS')
  ) {
    // Skip to DICE_ROLL
    nextPhase = 'DICE_ROLL'
  }

  return { phase: nextPhase, incrementRound: false }
}

/** Get the initial phase for combat */
export function getInitialPhase(): CombatPhase {
  return 'START_OF_ROUND'
}

// ============================================================================
// TWO-TIER PHASE SYSTEM
// ============================================================================
//
// The new two-tier phase system separates combat into:
// - MetaPhase: Major combat stages (Space Cannon, Space Combat, Bombardment, etc.)
// - MicroPhase: Steps within each meta-phase (START, AFB, DICE_ROLL, ASSIGN_HITS, END)
//
// This enables complex combat flows like:
// - SPACE mode: Space Cannon Offense -> Space Combat (AFB fires in round 1)
// - GROUND mode: Bombardment -> Space Cannon Defense -> Ground Combat
//
// Note: AFB is a micro-phase within SPACE_COMBAT, not a separate meta-phase.
// It only fires in round 1 of space combat.
//
// ============================================================================

const MICRO_PHASE_ORDER: MicroPhase[] = [
  'START',
  'AFB',
  'DICE_ROLL',
  'ASSIGN_HITS',
  'END',
]

export interface MicroPhaseTransition {
  phase: PhaseIdentifier
  incrementRound: boolean
}

/**
 * Get the next micro-phase within the current meta-phase.
 * Returns END when the micro-phase sequence is complete.
 *
 * AFB skip logic:
 * - AFB fires only in round 1 of SPACE_COMBAT
 * - In rounds 2+, SPACE_COMBAT skips directly from START to DICE_ROLL
 * - Non-SPACE_COMBAT meta-phases always skip AFB
 *
 * @param current Current phase identifier
 * @param round Current combat round (defaults to 1 for backward compatibility)
 */
export function getNextMicroPhase(
  current: PhaseIdentifier,
  round: number = 1,
): MicroPhaseTransition {
  const currentIndex = MICRO_PHASE_ORDER.indexOf(current.micro)

  if (current.micro === 'END') {
    // Caller should use getNextMetaPhase instead
    return {
      phase: current,
      incrementRound: false,
    }
  }

  let nextMicro = MICRO_PHASE_ORDER[currentIndex + 1]

  // AFB skip logic:
  // - AFB is a round-1 only step within SPACE_COMBAT
  // - All other meta-phases (SPACE_CANNON_OFFENSE, BOMBARDMENT, etc.) skip AFB
  // - This ensures Space Cannon Offense flows: START -> DICE_ROLL -> ASSIGN_HITS -> END
  if (nextMicro === 'AFB') {
    const shouldSkipAFB = current.meta !== 'SPACE_COMBAT' || round > 1
    if (shouldSkipAFB) {
      nextMicro = 'DICE_ROLL'
    }
  }

  return {
    phase: { meta: current.meta, micro: nextMicro },
    incrementRound: false,
  }
}

/**
 * Get the next meta-phase in the combat flow.
 * Should only be called when current micro-phase is END.
 *
 * @param current Current phase identifier
 * @param mode Combat mode (SPACE or GROUND)
 */
export function getNextMetaPhase(
  current: PhaseIdentifier,
  mode: CombatMode,
): MicroPhaseTransition {
  const flow = mode === 'SPACE' ? SPACE_COMBAT_FLOW : GROUND_COMBAT_FLOW
  const currentMetaIndex = flow.indexOf(current.meta)

  if (currentMetaIndex === -1 || current.meta === 'COMPLETE') {
    // Already complete or invalid state
    return { phase: { meta: 'COMPLETE', micro: 'END' }, incrementRound: false }
  }

  // Handle round-based transitions for combat phases
  // SPACE_COMBAT and GROUND_COMBAT loop back to START with round increment
  if (current.meta === 'SPACE_COMBAT' || current.meta === 'GROUND_COMBAT') {
    // Combat continues - loop back to START of same meta-phase
    return {
      phase: { meta: current.meta, micro: 'START' },
      incrementRound: true,
    }
  }

  // Pre-combat phases (Space Cannon, AFB, Bombardment) move to next meta-phase
  const nextMeta = flow[currentMetaIndex + 1]
  return {
    phase: { meta: nextMeta, micro: 'START' },
    incrementRound: false,
  }
}

/**
 * Get the next phase in the two-tier system.
 * Handles both micro-phase and meta-phase transitions.
 *
 * @param current Current phase identifier
 * @param mode Combat mode (SPACE or GROUND)
 * @param round Current combat round (for AFB skip logic)
 */
export function getNextPhaseIdentifier(
  current: PhaseIdentifier,
  mode: CombatMode,
  round: number = 1,
): MicroPhaseTransition {
  if (current.micro === 'END') {
    return getNextMetaPhase(current, mode)
  }
  return getNextMicroPhase(current, round)
}

/**
 * Get the initial phase identifier for a combat mode.
 */
export function getInitialPhaseIdentifier(mode: CombatMode): PhaseIdentifier {
  const flow = mode === 'SPACE' ? SPACE_COMBAT_FLOW : GROUND_COMBAT_FLOW
  return { meta: flow[0], micro: 'START' }
}

// Re-export getPhaseKey from types for convenience
export { getPhaseKey }
