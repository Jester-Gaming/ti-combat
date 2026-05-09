import type { SurvivorSide } from '@/combat'

export interface SurvivorEntry {
  variantKey: string
  base: string
  subtypes?: string[]
  healthy: number
  damaged: number
}

export function sortSurvivors(
  side: SurvivorSide,
  priority: readonly string[],
): SurvivorEntry[] {
  const entries: SurvivorEntry[] = []

  for (const [base, units] of Object.entries(side)) {
    if (!units || units.length === 0) continue
    const groups = new Map<string, { healthy: number; damaged: number }>()
    for (const u of units) {
      const subKey = u.subtypes?.join(',') ?? ''
      const g = groups.get(subKey) ?? { healthy: 0, damaged: 0 }
      if (u.isDamaged) g.damaged++
      else g.healthy++
      groups.set(subKey, g)
    }
    for (const [subKey, counts] of groups) {
      const variantKey = subKey ? `${base}:${subKey}` : base
      entries.push({
        variantKey,
        base,
        subtypes: subKey ? subKey.split(',') : undefined,
        healthy: counts.healthy,
        damaged: counts.damaged,
      })
    }
  }

  const rankOf = (entry: SurvivorEntry): number => {
    const exact = priority.indexOf(entry.variantKey)
    if (exact !== -1) return exact
    const base = priority.indexOf(entry.base)
    if (base !== -1) return base
    return -1
  }

  entries.sort((a, b) => rankOf(b) - rankOf(a))
  return entries
}
