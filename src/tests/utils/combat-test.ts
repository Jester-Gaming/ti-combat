import type { CombatSide, FactionKey, Unit, UnitType } from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import type { DicePool } from '../../combat/abilities/types'
import {
  CombatState,
  type StateWithProbability,
} from '../../combat/combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatStateData,
  MetaPhase,
  MicroPhase,
  SideStateData,
} from '../../combat/combat-state/types'
import type { LogEntry } from '../../combat/types'

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface SideConfig {
  faction: FactionKey
  units: Partial<Record<UnitType, number>>
  upgrades?: UnitType[]
  abilities?: Record<string, true | Record<string, unknown>>
}

export interface CombatTestConfig {
  mode: CombatMode
  attacker: SideConfig
  defender: SideConfig
}

// ============================================================================
// HITS SPEC
// ============================================================================

export type HitsSpec = number | { attacker?: number; defender?: number }

// ============================================================================
// UNIT CREATION HELPERS
// ============================================================================

/** Create Unit[] from a faction's unit definitions */
function createUnitsFromConfig(
  faction: FactionKey,
  unitType: UnitType,
  count: number,
  upgraded: boolean,
): Unit[] {
  const factionConfig = getFactionUnitConfig(faction)
  const def = factionConfig[unitType]
  if (!def?.BASE) return []

  let stats: Unit = { ...def.BASE }
  if (upgraded && def.UPGRADED) {
    stats = { ...stats, ...def.UPGRADED }
  }

  return Array.from({ length: count }, () => ({ ...stats }))
}

/** Build SideStateData from a SideConfig */
function buildSideState(config: SideConfig): SideStateData {
  const upgradedSet = new Set(config.upgrades ?? [])
  const units: Partial<Record<UnitType, Unit[]>> = {}

  for (const [type, count] of Object.entries(config.units)) {
    const unitType = type as UnitType
    if (!count || count <= 0) continue
    const upgraded = upgradedSet.has(unitType)
    units[unitType] = createUnitsFromConfig(
      config.faction,
      unitType,
      count,
      upgraded,
    )
  }

  return {
    faction: config.faction,
    units,
    unitStats: buildUnitStatsMap(config.faction, upgradedSet),
    hitPools: [],
  }
}

/** Build AbilitiesConfig from side configs */
function buildAbilitiesConfig(
  attacker: SideConfig,
  defender: SideConfig,
): AbilitiesConfig {
  const buildSideConfig = (
    config: SideConfig,
  ): Record<string, Record<string, unknown>> => {
    const result: Record<string, Record<string, unknown>> = {}
    if (!config.abilities) return result

    for (const [key, value] of Object.entries(config.abilities)) {
      if (value === true) {
        result[key] = { isEnabled: true }
      } else {
        result[key] = { ...value }
      }
    }
    return result
  }

  return {
    attacker: buildSideConfig(attacker),
    defender: buildSideConfig(defender),
  }
}

// ============================================================================
// COMBAT TEST CLASS
// ============================================================================

export class CombatTest {
  private _state: CombatStateData
  private _log: LogEntry[] = []
  private _round = 1

  constructor(combatState: CombatState) {
    this._state = combatState.data
  }

  // --- State access ---

  get state(): CombatStateData {
    return this._state
  }

  get attacker(): SideStateData {
    return this._state.attacker
  }

  get defender(): SideStateData {
    return this._state.defender
  }

  get log(): LogEntry[] {
    return this._log
  }

  // --- Phase control ---

  advanceTo(meta: MetaPhase, micro?: MicroPhase, hits: HitsSpec = 0): this {
    const MAX_ITERATIONS = 100

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { meta: curMeta, micro: curMicro } = this._state.currentPhase

      // Stop before executing the target phase
      if (curMeta === meta && (micro === undefined || curMicro === micro)) {
        break
      }

      if (curMeta === 'COMPLETE') break

      const cs = CombatState.fromData(this._state)
      const outcomes = cs.advance(this._round)

      const best = pickOutcomeByHits(outcomes, hits)
      this._state = best.state.data
      if (best.log) this._log.push(...best.log)

      // Track round transitions (END -> START means new round)
      if (
        curMicro === 'END' &&
        (curMeta === 'SPACE_COMBAT' || curMeta === 'GROUND_COMBAT')
      ) {
        this._round++
      }
    }

    return this
  }

  advanceRound(hits: HitsSpec = 0): this {
    const MAX_ITERATIONS = 100
    let passedEnd = false

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { meta: curMeta, micro: curMicro } = this._state.currentPhase

      if (curMeta === 'COMPLETE') break

      // Stop after we've processed an END micro-phase
      if (passedEnd) break

      const cs = CombatState.fromData(this._state)
      const outcomes = cs.advance(this._round)

      const best = pickOutcomeByHits(outcomes, hits)
      this._state = best.state.data
      if (best.log) this._log.push(...best.log)

      // Detect when we process END
      if (
        curMicro === 'END' &&
        (curMeta === 'SPACE_COMBAT' || curMeta === 'GROUND_COMBAT')
      ) {
        this._round++
        passedEnd = true
      }
    }

    return this
  }

  step(round?: number): StateWithProbability[] {
    const cs = CombatState.fromData(this._state)
    return cs.advance(round ?? this._round)
  }

  // --- Log query methods ---

  abilityLog(key: string, side?: CombatSide): LogEntry[] {
    return this._log.filter(entry => {
      if (!entry.path.includes(key)) return false
      if (side !== undefined && entry.side !== side) return false
      return true
    })
  }

  dicePool(): { attacker: DicePool; defender: DicePool } | undefined {
    // Find the last DICE_POOL entry
    for (let i = this._log.length - 1; i >= 0; i--) {
      const entry = this._log[i]
      if (entry.path[entry.path.length - 1] === 'DICE_POOL' && entry.data) {
        const data = entry.data[0] as {
          attacker: DicePool
          defender: DicePool
        }
        return { attacker: data.attacker, defender: data.defender }
      }
    }
    return undefined
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Pick the outcome matching the requested hit spec */
function pickOutcomeByHits(
  outcomes: StateWithProbability[],
  hits: HitsSpec,
): StateWithProbability {
  if (outcomes.length === 1) return outcomes[0]

  const match = outcomes.find(outcome => {
    const attackerHits = outcome.state.data.attacker.hitPools.reduce(
      (sum, p) => sum + p.hits,
      0,
    )
    const defenderHits = outcome.state.data.defender.hitPools.reduce(
      (sum, p) => sum + p.hits,
      0,
    )

    if (typeof hits === 'number') {
      return attackerHits + defenderHits === hits
    }

    const wantAttacker = hits.attacker ?? 0
    const wantDefender = hits.defender ?? 0
    return attackerHits === wantAttacker && defenderHits === wantDefender
  })

  if (!match) {
    const available = outcomes.map(o => {
      const a = o.state.data.attacker.hitPools.reduce(
        (sum, p) => sum + p.hits,
        0,
      )
      const d = o.state.data.defender.hitPools.reduce(
        (sum, p) => sum + p.hits,
        0,
      )
      return `{a:${a},d:${d}}`
    })
    const hitsStr =
      typeof hits === 'number'
        ? `${hits} total`
        : `{a:${hits.attacker ?? 0},d:${hits.defender ?? 0}}`
    throw new Error(
      `No outcome with ${hitsStr} hits. Available: [${available.join(', ')}]`,
    )
  }

  return match
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function combatTest(config: CombatTestConfig): CombatTest {
  const attackerSide = buildSideState(config.attacker)
  const defenderSide = buildSideState(config.defender)
  const abilitiesConfig = buildAbilitiesConfig(config.attacker, config.defender)

  // CombatState.forSimulation runs PREPARE timings
  const cs = CombatState.forSimulation(
    attackerSide,
    defenderSide,
    config.mode,
    abilitiesConfig,
  )

  return new CombatTest(cs)
}
