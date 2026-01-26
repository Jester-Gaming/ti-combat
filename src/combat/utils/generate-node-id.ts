import { v4 as uuidv4 } from 'uuid'

/**
 * Generates a unique ID for a ProbabilityNode using UUID v4.
 *
 * @returns A unique string identifier
 */
export function generateNodeId(): string {
  return uuidv4()
}
