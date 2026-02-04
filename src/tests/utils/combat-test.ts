import { getDestroyedUnits } from '@/combat/combat-side-state/utils/get-destroyed-units'
import type { CombatSide, FactionKey, Unit, UnitType } from '@/types'
import { getFactionUnitConfig } from '@/utils/get-faction-unit-config'
import { buildUnitStatsMap } from '@/utils/get-simulation-units'

import { AbilitiesParams, type SidedDiceData } from '../../combat/abilities'
import type {
  AbilityTiming,
  DestroyedUnit,
  DicePool,
  SidedContext,
} from '../../combat/abilities/types'
import {
  CombatState,
  type StateWithProbability,
} from '../../combat/combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatStateData,
  HitSource,
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
  private _params: AbilitiesParams
  private _log: LogEntry[] = []

  constructor(combatState: CombatState) {
    this._state = combatState.data
    this._params = combatState.params
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

  setPhase(meta: MetaPhase, micro: MicroPhase): this {
    this._state = {
      ...this._state,
      currentPhase: { meta, micro },
    }
    return this
  }

  advanceTo(meta: MetaPhase, micro?: MicroPhase, hits = 0): this {
    let round = 1
    const MAX_ITERATIONS = 100

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { meta: curMeta, micro: curMicro } = this._state.currentPhase

      // Stop before executing the target phase
      if (curMeta === meta && (micro === undefined || curMicro === micro)) {
        break
      }

      if (curMeta === 'COMPLETE') break

      const cs = CombatState.fromData(this._state)
      const outcomes = cs.advance(round)

      const best = pickOutcomeByHits(outcomes, hits)
      this._state = best.state.data
      if (best.log) this._log.push(...best.log)

      // Track round transitions (END -> START means new round)
      if (
        curMicro === 'END' &&
        (curMeta === 'SPACE_COMBAT' || curMeta === 'GROUND_COMBAT')
      ) {
        round++
      }
    }

    return this
  }

  step(round?: number): StateWithProbability[] {
    const cs = CombatState.fromData(this._state)
    return cs.advance(round ?? 1)
  }

  // --- Timing execution ---

  runTiming(timing: AbilityTiming | AbilityTiming[]): this {
    const timings = Array.isArray(timing) ? timing : [timing]
    const { state, log } = this._params.runAbilities(timings, this._state)
    this._state = state
    this._log.push(...log)
    return this
  }

  runDiceTiming(hitSource: HitSource): {
    attacker: DicePool
    defender: DicePool
  } {
    const timing: AbilityTiming =
      hitSource === 'COMBAT' ? 'BEFORE_DICE_ROLL' : 'BEFORE_UNIT_ABILITY_ROLL'

    const cs = CombatState.fromData(this._state)
    const attackerDice = cs.collectDice('attacker', hitSource)
    const defenderDice = cs.collectDice('defender', hitSource)

    const sidedDiceData: SidedDiceData = {
      attacker: attackerDice,
      defender: defenderDice,
    }

    const {
      state,
      context: modifiedDice,
      log,
    } = this._params.runAbilities(timing, this._state, sidedDiceData)
    this._state = state
    this._log.push(...log)

    return {
      attacker: modifiedDice.attacker,
      defender: modifiedDice.defender,
    }
  }

  // --- State manipulation ---

  addHits(side: CombatSide, hits: number, validTargets?: UnitType[]): this {
    const tempCS = CombatState.fromData(this._state)
    tempCS.side(side).addHits(hits, validTargets ?? [])
    this._state = tempCS.data
    return this
  }

  destroyUnit(side: CombatSide, unitType: UnitType, index?: number): this {
    const idx = index ?? 0
    const sideState = this._state[side]
    const units = sideState.units[unitType]
    if (!units || idx < 0 || idx >= units.length) return this

    const destroyedUnit = units[idx]

    // Remove the unit
    const remaining = [...units.slice(0, idx), ...units.slice(idx + 1)]
    const newUnits = { ...sideState.units }
    if (remaining.length > 0) {
      newUnits[unitType] = remaining
    } else {
      delete newUnits[unitType]
    }

    const stateAfterRemoval: CombatStateData = {
      ...this._state,
      [side]: {
        ...sideState,
        units: newUnits,
      },
    }

    // Build destroyed context and run AFTER_DESTROY
    const destroyedContext: SidedContext<DestroyedUnit[]> = {
      attacker:
        side === 'attacker' ? [{ type: unitType, unit: destroyedUnit }] : [],
      defender:
        side === 'defender' ? [{ type: unitType, unit: destroyedUnit }] : [],
    }

    const { state, log } = this._params.runAbilities(
      'AFTER_DESTROY',
      stateAfterRemoval,
      destroyedContext,
    )
    this._state = state
    this._log.push(...log)
    return this
  }

  assignHits(): this {
    const cs = CombatState.fromData(this._state)
    const result = cs.assignHits()
    // Compute log by comparing states
    const beforeUnits = {
      attacker: this._state.attacker.units,
      defender: this._state.defender.units,
    }
    this._state = result.data

    // Log destroyed units
    for (const side of ['attacker', 'defender'] as CombatSide[]) {
      const destroyed = getDestroyedUnits(
        beforeUnits[side],
        this._state[side].units,
      )
      if (destroyed.length > 0) {
        this._log.push([
          this._state.currentPhase.meta,
          'ASSIGN_HITS',
          side,
          destroyed.map(d => d.type),
        ])
      }
    }

    return this
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Pick the outcome matching the requested total hit count */
function pickOutcomeByHits(
  outcomes: StateWithProbability[],
  hits: number,
): StateWithProbability {
  if (outcomes.length === 1) return outcomes[0]

  const match = outcomes.find(outcome => {
    const totalHits =
      outcome.state.attacker.hitPools.reduce((sum, p) => sum + p.hits, 0) +
      outcome.state.defender.hitPools.reduce((sum, p) => sum + p.hits, 0)
    return totalHits === hits
  })

  if (!match) {
    const available = outcomes.map(o => {
      const total =
        o.state.attacker.hitPools.reduce((sum, p) => sum + p.hits, 0) +
        o.state.defender.hitPools.reduce((sum, p) => sum + p.hits, 0)
      return total
    })
    throw new Error(
      `No outcome with ${hits} total hits. Available: [${available.join(', ')}]`,
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
