import type { SideStateData } from '../../combat-state/types'

export function getDestroyedUnits(
  before: SideStateData,
  after: SideStateData,
): Record<string, number> {
  const destroyed: Record<string, number> = {}

  for (const key of Object.keys(before.units)) {
    const diff = (before.units[key] ?? 0) - (after.units[key] ?? 0)
    if (diff > 0) {
      destroyed[key] = diff
    }
  }

  return destroyed
}
