import {
  type AbilitiesConfig,
  AbilitiesEngine,
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  CombatState,
  type CombatStateData,
  extractDefaults,
  getOpponentSide,
  type SideStateData,
} from '@/combat'
import { UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import factions from '@/data/faction'
import type {
  CombatSide,
  FactionKey,
  UnitBaseType,
  UnitSelection,
} from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import {
  getAvailableAbilities,
  getFactionOwnedAbilityKeys,
  getUnitDefinitionAbilityKeys,
} from './get-available-abilities'
import {
  initializeAbilityDefaults,
  reconcileAbilitiesConfig,
  type SyncSnapshots,
} from './reconcile'
import {
  serializeAbilities,
  type SerializedConfig,
  serializeUnits,
} from './serialization'
import type { SimulationInput } from './types'

function createDefaultUnitSelections(): Record<UnitBaseType, UnitSelection> {
  return UNIT_TYPES.reduce(
    (acc, unitType) => {
      acc[unitType] = { count: 0, upgraded: false }
      return acc
    },
    {} as Record<UnitBaseType, UnitSelection>,
  )
}

/**
 * Internal backing class for UI state management.
 * Manages unit selections, factions, abilities config, and reconciliation.
 * Not exported publicly — the hook is the API.
 */
export class CombatSetup {
  private _attackerFaction: FactionKey
  private _defenderFaction: FactionKey
  private _attackerSelections: Record<UnitBaseType, UnitSelection>
  private _defenderSelections: Record<UnitBaseType, UnitSelection>
  private _combatMode: CombatMode
  private _abilities: AbilitiesConfig
  private _sideAbilities: Record<CombatSide, Ability[]>
  private _unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>
  private _stateData: CombatStateData
  private _engine: AbilitiesEngine
  private _syncSnapshots: SyncSnapshots = new Map()

  constructor() {
    const defaultFaction = Object.keys(factions)[0] as FactionKey
    const defaultUnitStats = buildUnitStatsMap(defaultFaction)

    this._attackerFaction = defaultFaction
    this._defenderFaction = defaultFaction
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
    this._combatMode = 'SPACE'
    this._abilities = { attacker: {}, defender: {} }

    this._sideAbilities = {
      attacker: getAvailableAbilities(
        'attacker',
        defaultFaction,
        this.getUpgradedTypes('attacker'),
      ),
      defender: getAvailableAbilities(
        'defender',
        defaultFaction,
        this.getUpgradedTypes('defender'),
      ),
    }
    this._unitAbilityKeys = {
      attacker: getUnitDefinitionAbilityKeys(defaultFaction),
      defender: getUnitDefinitionAbilityKeys(defaultFaction),
    }
    this._factionOwnedKeys = {
      attacker: getFactionOwnedAbilityKeys(defaultFaction),
      defender: getFactionOwnedAbilityKeys(defaultFaction),
    }

    this._stateData = {
      attacker: {
        faction: defaultFaction,
        units: {} as SideStateData['units'],
        unitState: {},
        unitStats: defaultUnitStats,
        hitPools: [],
      },
      defender: {
        faction: defaultFaction,
        units: {} as SideStateData['units'],
        unitState: {},
        unitStats: defaultUnitStats,
        hitPools: [],
      },
      abilities: this._abilities,
      liveAbilities: { attacker: {}, defender: {} },
      combatMode: 'SPACE',
    }

    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )

    const wrapState = CombatState.fromDataStandalone(
      this._stateData,
      this._sideAbilities,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
    this._engine = AbilitiesEngine.wrap(
      wrapState,
      this._sideAbilities,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get attackerFaction(): FactionKey {
    return this._attackerFaction
  }

  get defenderFaction(): FactionKey {
    return this._defenderFaction
  }

  get attackerSelections(): Record<UnitBaseType, UnitSelection> {
    return this._attackerSelections
  }

  get defenderSelections(): Record<UnitBaseType, UnitSelection> {
    return this._defenderSelections
  }

  get combatMode(): CombatMode {
    return this._combatMode
  }

  get abilities(): AbilitiesConfig {
    return this._abilities
  }

  get stateData(): CombatStateData {
    return this._stateData
  }

  getAvailableAbilities(side: CombatSide): Ability[] {
    return this._sideAbilities[side]
  }

  getReadContext(side: CombatSide): AbilityReadContext {
    return this._engine.context(side) as unknown as AbilityReadContext
  }

  // ── Mutations ──────────────────────────────────────────────────────

  setFaction(side: CombatSide, faction: FactionKey): void {
    if (side === 'attacker') {
      this._attackerFaction = faction
    } else {
      this._defenderFaction = faction
    }

    // Reload abilities for the changed side
    this._sideAbilities[side] = getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    this._unitAbilityKeys[side] = getUnitDefinitionAbilityKeys(faction)
    this._factionOwnedKeys[side] = getFactionOwnedAbilityKeys(faction)

    // Rebuild side config: keep existing params for surviving abilities,
    // initialize defaults for new ones
    const oldSideConfig = this._abilities[side]
    const newSideConfig: Record<string, Record<string, unknown>> = {}

    for (const ability of this._sideAbilities[side]) {
      const defaults = extractDefaults(ability)
      if (oldSideConfig[ability.key]) {
        newSideConfig[ability.key] = { ...oldSideConfig[ability.key] }
      } else if (defaults) {
        newSideConfig[ability.key] = { ...defaults }
      }
    }

    this._abilities[side] = newSideConfig

    // Rebuild unit data
    const selections = this.selectionsForSide(side)
    this.rebuildUnits(side, faction, selections)

    // Reconcile
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    this.rebuildEngine()
  }

  setUnitCount(side: CombatSide, unitType: UnitBaseType, count: number): void {
    const limit = UNIT_LIMITS[unitType]
    if (count > limit) {
      console.warn(`Unit limit exceeded: ${unitType} has a maximum of ${limit}`)
      count = limit
    }
    this.updateSelection(side, unitType, { count })
  }

  setUpgraded(
    side: CombatSide,
    unitType: UnitBaseType,
    upgraded: boolean,
  ): void {
    this.updateSelection(side, unitType, { upgraded })
  }

  isUpgraded(side: CombatSide, unitType: UnitBaseType): boolean {
    return this.selectionsForSide(side)[unitType].upgraded
  }

  setAbilityParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    this.setParam(side, abilityKey, params)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    // Force new stateData reference so React memoization triggers
    this._stateData = { ...this._stateData }
    this.rebuildEngine()
  }

  setCombatMode(mode: CombatMode): void {
    this._combatMode = mode
    this._stateData = {
      ...this._stateData,
      combatMode: mode,
    }
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    this.rebuildEngine()
  }

  resetUnits(side: CombatSide): void {
    const newSelections = createDefaultUnitSelections()
    if (side === 'attacker') {
      this._attackerSelections = newSelections
    } else {
      this._defenderSelections = newSelections
    }

    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction, newSelections)

    // Upgrades may have changed — recalculate available abilities
    this._sideAbilities[side] = getAvailableAbilities(
      side,
      faction,
      this.getUpgradedTypes(side),
    )
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    this.rebuildEngine()
  }

  resetAbilities(side: CombatSide): void {
    this._abilities[side] = {}
    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    // Force new stateData reference so React memoization triggers
    this._stateData = { ...this._stateData }
    this.rebuildEngine()
  }

  swap(): void {
    // Swap factions
    ;[this._attackerFaction, this._defenderFaction] = [
      this._defenderFaction,
      this._attackerFaction,
    ]

    // Swap selections
    ;[this._attackerSelections, this._defenderSelections] = [
      this._defenderSelections,
      this._attackerSelections,
    ]

    // Swap side abilities
    ;[this._sideAbilities.attacker, this._sideAbilities.defender] = [
      this._sideAbilities.defender,
      this._sideAbilities.attacker,
    ]

    // Swap abilities config
    this._abilities = {
      attacker: this._abilities.defender,
      defender: this._abilities.attacker,
    }

    // Rebuild stateData
    this._stateData = {
      ...this._stateData,
      attacker: this._stateData.defender,
      defender: this._stateData.attacker,
      abilities: this._abilities,
    }

    // Rebuild units for both sides
    this.rebuildUnits(
      'attacker',
      this._attackerFaction,
      this._attackerSelections,
    )
    this.rebuildUnits(
      'defender',
      this._defenderFaction,
      this._defenderSelections,
    )

    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    this.rebuildEngine()
  }

  toSimulationInput(): SimulationInput | null {
    const hasUnits =
      Object.values(this._attackerSelections).some(s => s.count > 0) ||
      Object.values(this._defenderSelections).some(s => s.count > 0)
    if (!hasUnits) return null
    return {
      attackerFaction: this._attackerFaction,
      defenderFaction: this._defenderFaction,
      attackerSelections: this._attackerSelections,
      defenderSelections: this._defenderSelections,
      combatMode: this._combatMode,
      abilities: this._abilities,
    }
  }

  toSerializedConfig(): SerializedConfig {
    // Compute reconciled defaults to diff against — this captures
    // auto-populated values (declared params with source) so we only
    // store what the user actually changed
    const freshAbilities: AbilitiesConfig = { attacker: {}, defender: {} }
    initializeAbilityDefaults(freshAbilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      freshAbilities,
      this._sideAbilities,
      this._combatMode,
    )

    return {
      v: 1,
      af: this._attackerFaction,
      df: this._defenderFaction,
      m: this._combatMode === 'SPACE' ? 'S' : 'G',
      au: serializeUnits(this._attackerSelections),
      du: serializeUnits(this._defenderSelections),
      aa: serializeAbilities(this._abilities.attacker, freshAbilities.attacker),
      da: serializeAbilities(this._abilities.defender, freshAbilities.defender),
    }
  }

  loadConfig(config: SerializedConfig): void {
    const af = config.af as FactionKey
    const df = config.df as FactionKey

    // Set factions
    this._attackerFaction = af
    this._defenderFaction = df
    this._combatMode = config.m === 'S' ? 'SPACE' : 'GROUND'

    // Set unit selections
    this._attackerSelections = createDefaultUnitSelections()
    this._defenderSelections = createDefaultUnitSelections()
    for (const [type, [count, upgraded]] of Object.entries(config.au)) {
      const ut = type as UnitBaseType
      if (this._attackerSelections[ut]) {
        this._attackerSelections[ut] = { count, upgraded: upgraded === 1 }
      }
    }
    for (const [type, [count, upgraded]] of Object.entries(config.du)) {
      const ut = type as UnitBaseType
      if (this._defenderSelections[ut]) {
        this._defenderSelections[ut] = { count, upgraded: upgraded === 1 }
      }
    }

    // Rebuild abilities for new factions
    this._sideAbilities = {
      attacker: getAvailableAbilities(
        'attacker',
        af,
        this.getUpgradedTypes('attacker'),
      ),
      defender: getAvailableAbilities(
        'defender',
        df,
        this.getUpgradedTypes('defender'),
      ),
    }
    this._unitAbilityKeys = {
      attacker: getUnitDefinitionAbilityKeys(af),
      defender: getUnitDefinitionAbilityKeys(df),
    }
    this._factionOwnedKeys = {
      attacker: getFactionOwnedAbilityKeys(af),
      defender: getFactionOwnedAbilityKeys(df),
    }

    // Initialize ability defaults, reconcile, then apply URL overrides
    this._abilities = { attacker: {}, defender: {} }
    initializeAbilityDefaults(this._abilities, this._sideAbilities)
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )

    // Apply URL ability params on top of reconciled defaults
    for (const [key, params] of Object.entries(config.aa)) {
      if (this._abilities.attacker[key]) {
        this._abilities.attacker[key] = {
          ...this._abilities.attacker[key],
          ...params,
        }
      }
    }
    for (const [key, params] of Object.entries(config.da)) {
      if (this._abilities.defender[key]) {
        this._abilities.defender[key] = {
          ...this._abilities.defender[key],
          ...params,
        }
      }
    }

    // Rebuild units for both sides
    this.rebuildUnits('attacker', af, this._attackerSelections)
    this.rebuildUnits('defender', df, this._defenderSelections)

    // Rebuild stateData references
    this._stateData = {
      ...this._stateData,
      abilities: this._abilities,
      combatMode: this._combatMode,
    }

    // Final reconcile and engine rebuild
    reconcileAbilitiesConfig(
      this._abilities,
      this._sideAbilities,
      this._combatMode,
      this._syncSnapshots,
    )
    this.rebuildEngine()
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private getUpgradedTypes(side: CombatSide): Set<UnitBaseType> {
    const sel = this.selectionsForSide(side)
    const set = new Set<UnitBaseType>()
    for (const [k, v] of Object.entries(sel)) {
      if (v.upgraded) set.add(k as UnitBaseType)
    }
    return set
  }

  private selectionsForSide(
    side: CombatSide,
  ): Record<UnitBaseType, UnitSelection> {
    return side === 'attacker'
      ? this._attackerSelections
      : this._defenderSelections
  }

  private updateSelection(
    side: CombatSide,
    unitType: UnitBaseType,
    update: Partial<UnitSelection>,
  ): void {
    const selections = this.selectionsForSide(side)
    const upgradeChanged =
      'upgraded' in update && update.upgraded !== selections[unitType].upgraded
    const newSelections = {
      ...selections,
      [unitType]: { ...selections[unitType], ...update },
    }
    if (side === 'attacker') {
      this._attackerSelections = newSelections
    } else {
      this._defenderSelections = newSelections
    }

    const faction =
      side === 'attacker' ? this._attackerFaction : this._defenderFaction
    this.rebuildUnits(side, faction, newSelections)

    if (upgradeChanged) {
      this._sideAbilities[side] = getAvailableAbilities(
        side,
        faction,
        this.getUpgradedTypes(side),
      )
      reconcileAbilitiesConfig(
        this._abilities,
        this._sideAbilities,
        this._combatMode,
        this._syncSnapshots,
      )
      this.rebuildEngine()
    } else {
      this.refreshEngine()
    }
  }

  private rebuildUnits(
    side: CombatSide,
    faction: FactionKey,
    selections: Record<UnitBaseType, UnitSelection>,
  ): void {
    const upgradedSet = new Set(
      (Object.keys(selections) as UnitBaseType[]).filter(
        t => selections[t].upgraded,
      ),
    )
    const { units, unitState, unitStats } = getSimulationUnits(
      faction,
      selections,
    )
    this._stateData = {
      ...this._stateData,
      [side]: {
        ...this._stateData[side],
        faction,
        units,
        unitState,
        unitStats: {
          ...buildUnitStatsMap(faction, upgradedSet),
          ...unitStats,
        },
      },
    }
  }

  private setParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    const ability = this._sideAbilities[side].find(a => a.key === abilityKey)

    let finalParams = params
    if (ability?.onParamSet) {
      const oldParams = this._abilities[side][abilityKey]
      if (oldParams) {
        for (const key of Object.keys(params)) {
          if (params[key] !== oldParams[key]) {
            finalParams =
              ability.onParamSet(finalParams, key, params[key]) ?? finalParams
          }
        }
      }
    }

    const newSideConfig = {
      ...this._abilities[side],
      [abilityKey]: finalParams,
    }

    // Mutual exclusion: disable other abilities in the same exclusive group
    if (ability?.exclusiveGroup && finalParams.isEnabled) {
      for (const other of this._sideAbilities[side]) {
        if (other.key === abilityKey) continue
        if (other.exclusiveGroup !== ability.exclusiveGroup) continue
        const otherParams = newSideConfig[other.key]
        if (otherParams) {
          newSideConfig[other.key] = {
            ...otherParams,
            isEnabled: false,
          }
        }
      }
    }

    this._abilities[side] = newSideConfig

    if (ability?.sync) {
      const otherSide = getOpponentSide(side)
      this._abilities[otherSide] = {
        ...this._abilities[otherSide],
        [abilityKey]: finalParams,
      }
    }
  }

  private rebuildEngine(): void {
    const wrapState = CombatState.fromData(this._stateData, this._engine)
    this._engine = AbilitiesEngine.wrap(
      wrapState,
      this._sideAbilities,
      this._unitAbilityKeys,
      this._factionOwnedKeys,
    )
  }

  private refreshEngine(): void {
    const wrapState = CombatState.fromData(this._stateData, this._engine)
    this._engine.setCombatState(wrapState)
  }
}
