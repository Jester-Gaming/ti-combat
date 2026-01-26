import type { CombatPhase } from './types'

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
