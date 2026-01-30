import type { Ability, DeclaredSubtype } from '../types'

/**
 * Iterate all abilities, check if enabled (headerUI param truthy or no headerUI),
 * call declareSubtypes on those that have it, and return aggregated list.
 */
export function collectDeclaredSubtypes(
  abilities: readonly Ability[],
  params: Record<string, Record<string, unknown>>,
): DeclaredSubtype[] {
  const result: DeclaredSubtype[] = []

  for (const ability of abilities) {
    if (!ability.declareSubtypes) continue

    const abilityParams = {
      ...ability.defaultParams,
      ...params[ability.key],
    }

    // Check if ability is enabled (headerUI param truthy or no headerUI)
    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareSubtypes(abilityParams)
    result.push(...declared)
  }

  return result
}
