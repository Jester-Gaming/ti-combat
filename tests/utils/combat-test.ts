import {
  type Ability,
  CombatState,
  type CombatStateData,
  type DicePool,
  type LogEntry,
  type MetaPhase,
  type MicroPhase,
  parseVariantId,
  type SideStateData,
  type StateWithProbability,
} from '@/combat'
import {
  buildCombatState,
  type CombatStateConfig,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'
import type { CombatSide, UnitBaseType, UnitState } from '@/types'

export type { SideConfig }
export type CombatTestConfig = CombatStateConfig

// ============================================================================
// REVERSED MODE (for forEachSide tests)
// ============================================================================

let _reversed = false

export function setReversed(value: boolean) {
  _reversed = value
}

const swapSide = (s: CombatSide): CombatSide =>
  s === 'attacker' ? 'defender' : 'attacker'

// ============================================================================
// HITS SPEC
// ============================================================================

export type HitsSpec = number | { attacker?: number; defender?: number }

// ============================================================================
// SIDE VIEW (reconstructs units for test assertions)
// ============================================================================

type TestUnit = UnitState & { subtypes?: string[] }

type SideView = Omit<SideStateData, 'units' | 'unitState' | 'unitStats'> & {
  units: Partial<Record<UnitBaseType, TestUnit[]>>
}

function buildSideView(data: SideStateData): SideView {
  const { unitState, unitStats, units, ...rest } = data
  void unitStats
  const result: Partial<Record<UnitBaseType, TestUnit[]>> = {}

  for (const key of Object.keys(units)) {
    const ids = units[key]
    if (ids.length <= 0) continue
    const { type, subtypes } = parseVariantId(key)
    const arr = result[type] ?? (result[type] = [])
    for (const id of ids) {
      const state = unitState[id]
      const unit: TestUnit = { ...state }
      if (subtypes.length > 0) unit.subtypes = subtypes
      arr.push(unit)
    }
  }

  return { ...rest, units: result }
}

// ============================================================================
// COMBAT TEST CLASS
// ============================================================================

export class CombatTest {
  private _state: CombatStateData
  private _abilities: Record<CombatSide, Ability[]>
  private _unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>
  private _log: LogEntry[] = []
  private _round = 1
  private _reversed: boolean

  constructor(combatState: CombatState, reversed = false) {
    this._state = combatState.data
    this._abilities = {
      attacker: combatState.params.getAbilities('attacker'),
      defender: combatState.params.getAbilities('defender'),
    }
    this._unitAbilityKeys = combatState.params.unitAbilityKeys
    this._reversed = reversed
  }

  // --- Reversed mode helpers ---

  private _side(side: CombatSide): CombatSide {
    return this._reversed ? swapSide(side) : side
  }

  private _mapHits(hits: HitsSpec): HitsSpec {
    if (!this._reversed || typeof hits === 'number') return hits
    return { attacker: hits.defender, defender: hits.attacker }
  }

  // --- State access ---

  get state(): CombatStateData {
    if (!this._reversed) return this._state
    return {
      ...this._state,
      attacker: this._state.defender,
      defender: this._state.attacker,
      abilities: {
        attacker: this._state.abilities.defender,
        defender: this._state.abilities.attacker,
      },
    }
  }

  get attacker(): SideView {
    return buildSideView(this._state[this._side('attacker')])
  }

  get defender(): SideView {
    return buildSideView(this._state[this._side('defender')])
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

      const cs = CombatState.fromDataStandalone(
        this._state,
        this._abilities,
        this._unitAbilityKeys,
      )
      const outcomes = cs.advance(this._round, true)

      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._state = best.state.data
      if (best.state.log) this._log.push(...best.state.log)

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

      const cs = CombatState.fromDataStandalone(
        this._state,
        this._abilities,
        this._unitAbilityKeys,
      )
      const outcomes = cs.advance(this._round, true)

      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._state = best.state.data
      if (best.state.log) this._log.push(...best.state.log)

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
    const cs = CombatState.fromDataStandalone(
      this._state,
      this._abilities,
      this._unitAbilityKeys,
    )
    return cs.advance(round ?? this._round, true)
  }

  // --- Log query methods ---

  abilityLog(key: string, side?: CombatSide): LogEntry[] {
    const mappedSide =
      side !== undefined && this._reversed ? swapSide(side) : side
    return this._log.filter(entry => {
      if (!entry.path.includes(key)) return false
      if (mappedSide !== undefined && entry.side !== mappedSide) return false
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
        if (this._reversed) {
          return { attacker: data.defender, defender: data.attacker }
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
  const reversed = _reversed
  const effectiveConfig = reversed
    ? { ...config, attacker: config.defender, defender: config.attacker }
    : config
  return new CombatTest(buildCombatState(effectiveConfig), reversed)
}
