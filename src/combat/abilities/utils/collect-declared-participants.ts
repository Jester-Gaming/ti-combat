import type { Ability, DeclaredParticipant } from '../types'

/**
 * Iterate all abilities, check if enabled (headerUI param truthy or no headerUI),
 * call declareParticipants on those that have it, and return aggregated list.
 */
export function collectDeclaredParticipants(
  abilities: readonly Ability[],
  params: Record<string, Record<string, unknown>>,
): DeclaredParticipant[] {
  const result: DeclaredParticipant[] = []

  for (const ability of abilities) {
    if (!ability.declareParticipants) continue

    const abilityParams = {
      ...ability.defaultParams,
      ...params[ability.key],
    }

    // Check if ability is enabled (headerUI param truthy or no headerUI)
    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareParticipants(abilityParams)
    result.push(...declared)
  }

  return result
}
