import type {
  CombatMode,
  MetaPhase,
  MicroPhase,
  PhaseIdentifier,
} from './types'

/**
 * The ordered sequence of meta-phases for space combat.
 * Combat proceeds through these phases in order.
 */
const SPACE_FLOW: readonly MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'SPACE_COMBAT',
  'COMPLETE',
] as const

/**
 * The ordered sequence of meta-phases for ground combat.
 * Combat proceeds through these phases in order.
 */
const GROUND_FLOW: readonly MetaPhase[] = [
  'BOMBARDMENT',
  'COMMIT_UNITS',
  'SPACE_CANNON_DEFENSE',
  'GROUND_COMBAT',
  'COMPLETE',
] as const

/**
 * Micro-phase order for each meta-phase.
 * Each meta-phase has its own flow through micro-phases.
 */

const UNIT_ABILITY = ['DICE_ROLL', 'ASSIGN_HITS'] as const
const COMBAT_PHASES = ['START', 'DICE_ROLL', 'ASSIGN_HITS', 'END'] as const

const MICRO_PHASE_ORDERS: Record<MetaPhase, readonly MicroPhase[]> = {
  SPACE_CANNON_OFFENSE: UNIT_ABILITY,
  AFB: UNIT_ABILITY,
  BOMBARDMENT: UNIT_ABILITY,
  COMMIT_UNITS: ['END'],
  SPACE_CANNON_DEFENSE: UNIT_ABILITY,

  SPACE_COMBAT: COMBAT_PHASES,
  GROUND_COMBAT: COMBAT_PHASES,

  // Terminal phase
  COMPLETE: ['END'],
}

/** Get the first micro-phase for a meta-phase */
export function getFirstMicroPhase(meta: MetaPhase): MicroPhase {
  return MICRO_PHASE_ORDERS[meta][0]
}

/** Get the last micro-phase for a meta-phase */
export function getLastMicroPhase(meta: MetaPhase): MicroPhase {
  const order = MICRO_PHASE_ORDERS[meta]
  return order[order.length - 1]
}

/** Check if a micro-phase is the last one for its meta-phase */
export function isLastMicroPhase(phase: PhaseIdentifier): boolean {
  return phase.micro === getLastMicroPhase(phase.meta)
}

/**
 * Get the next micro-phase within the current meta-phase.
 * Returns current phase if already at the last micro-phase.
 *
 * @param current Current phase identifier
 */
export function getNextMicroPhase(current: PhaseIdentifier): PhaseIdentifier {
  if (isLastMicroPhase(current)) {
    // Caller should use getNextMetaPhase instead
    return current
  }

  const order = MICRO_PHASE_ORDERS[current.meta]
  const currentIndex = order.indexOf(current.micro)
  const nextMicro = order[currentIndex + 1]

  return { meta: current.meta, micro: nextMicro }
}

/**
 * Get the next meta-phase in the combat flow.
 * Should only be called when current micro-phase is the last one.
 *
 * @param current Current phase identifier
 * @param mode Combat mode (SPACE or GROUND)
 */
export function getNextMetaPhase(
  current: PhaseIdentifier,
  mode: CombatMode,
): PhaseIdentifier {
  const flow = mode === 'SPACE' ? SPACE_FLOW : GROUND_FLOW
  const currentMetaIndex = flow.indexOf(current.meta)

  // Special case: AFB ends by returning to SPACE_COMBAT:DICE_ROLL (skipping START)
  if (current.meta === 'AFB') {
    return { meta: 'SPACE_COMBAT', micro: 'DICE_ROLL' }
  }

  if (currentMetaIndex === -1 || current.meta === 'COMPLETE') {
    // Already complete or invalid state
    return { meta: 'COMPLETE', micro: getLastMicroPhase('COMPLETE') }
  }

  // Handle round-based transitions for combat phases
  // SPACE_COMBAT and GROUND_COMBAT loop back to first micro-phase of same meta-phase
  if (current.meta === 'SPACE_COMBAT' || current.meta === 'GROUND_COMBAT') {
    // Combat continues - loop back to first micro-phase of same meta-phase
    return { meta: current.meta, micro: getFirstMicroPhase(current.meta) }
  }

  // Pre-combat phases (Space Cannon, Bombardment) move to next meta-phase
  const nextMeta = flow[currentMetaIndex + 1]
  return { meta: nextMeta, micro: getFirstMicroPhase(nextMeta) }
}

/**
 * Get the initial phase identifier for a combat mode.
 */
export function getInitialPhaseIdentifier(mode: CombatMode): PhaseIdentifier {
  const flow = mode === 'SPACE' ? SPACE_FLOW : GROUND_FLOW
  const firstMeta = flow[0]
  return { meta: firstMeta, micro: getFirstMicroPhase(firstMeta) }
}
