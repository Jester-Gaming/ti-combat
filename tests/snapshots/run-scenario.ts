import { CombatEngine, type SurvivorSide } from '@/combat'
import type { CombatMode } from '@/combat/combat-state/types'
import { UNIT_SHORT_NAMES, UNIT_TYPES } from '@/constants/units'
import {
  buildCombatState,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'
import type { FactionKey, UnitBaseType } from '@/types'

const SHORT_TO_BASE: Record<string, UnitBaseType> = Object.fromEntries(
  (Object.entries(UNIT_SHORT_NAMES) as [UnitBaseType, string][]).map(
    ([base, short]) => [short, base],
  ),
)

const BASE_PRIORITY: Record<UnitBaseType, number> = Object.fromEntries(
  UNIT_TYPES.map((t, i) => [t, i]),
) as Record<UnitBaseType, number>

function parseUnits(input: string): SideConfig['units'] {
  const units: SideConfig['units'] = {}
  for (const raw of input.split(',')) {
    const token = raw.trim()
    if (!token) continue
    const match = /^(\d*)([A-Za-z]+)$/.exec(token)
    if (!match) throw new Error(`Invalid unit token: "${token}"`)
    const count = match[1] ? parseInt(match[1], 10) : 1
    const baseType = SHORT_TO_BASE[match[2]]
    if (!baseType) throw new Error(`Unknown unit short name: "${match[2]}"`)
    units[baseType] = (units[baseType] ?? 0) + count
  }
  return units
}

function formatSide(side: SurvivorSide): string {
  const entries = Object.entries(side).filter(
    ([, units]) => units && units.length > 0,
  )
  entries.sort(([a], [b]) => {
    const aBase = a.split(':')[0] as UnitBaseType
    const bBase = b.split(':')[0] as UnitBaseType
    return (BASE_PRIORITY[aBase] ?? 999) - (BASE_PRIORITY[bBase] ?? 999)
  })

  const parts: string[] = []
  for (const [unitType, units] of entries) {
    if (!units) continue
    const baseType = unitType.split(':')[0] as UnitBaseType
    const name = UNIT_SHORT_NAMES[baseType] ?? unitType

    const groups = new Map<string, { healthy: number; damaged: number }>()
    for (const u of units) {
      const key = u.subtypes?.join(',') ?? ''
      const g = groups.get(key) ?? { healthy: 0, damaged: 0 }
      if (u.isDamaged) g.damaged++
      else g.healthy++
      groups.set(key, g)
    }

    for (const [subtypeKey, { healthy, damaged }] of groups) {
      const label = subtypeKey ? `${name}:${subtypeKey}` : name
      if (healthy > 0) {
        parts.push(healthy > 1 ? `${healthy}${label}` : label)
      }
      if (damaged > 0) {
        const dmgLabel = `${label}-`
        parts.push(damaged > 1 ? `${damaged}${dmgLabel}` : dmgLabel)
      }
    }
  }

  return parts.join(', ')
}

const PROBABILITY_DECIMALS = 10
const PROBABILITY_FACTOR = 10 ** PROBABILITY_DECIMALS

interface FormattedOutcome {
  attacker: string
  defender: string
  winner: 'attacker' | 'defender' | 'draw'
  probability: number
}

export function runScenario(
  mode: CombatMode,
  attacker: string,
  defender: string,
  faction: FactionKey = 'ARBOREC',
): FormattedOutcome[] {
  const state = buildCombatState({
    mode,
    attacker: { faction, units: parseUnits(attacker) },
    defender: { faction, units: parseUnits(defender) },
  })
  const engine = new CombatEngine()
  return engine.simulate(state).map(o => ({
    attacker: formatSide(o.attacker),
    defender: formatSide(o.defender),
    winner: o.winner,
    probability:
      Math.round(o.probability * PROBABILITY_FACTOR) / PROBABILITY_FACTOR,
  }))
}
