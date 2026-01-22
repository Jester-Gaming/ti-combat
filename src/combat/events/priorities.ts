/**
 * Handler priority constants.
 * Lower values execute first.
 *
 * CORE (0): Built-in combat mechanics (dice rolls, hit assignment)
 * Future ability priorities will be added here (e.g., ABILITY = 100)
 */
export const PRIORITY = {
  /** Core combat mechanics - executes first */
  CORE: 0,
} as const

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY]
