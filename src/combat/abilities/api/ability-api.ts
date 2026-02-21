import { getSettingsValidTargets } from '@/combat/combat-side-state/utils/get-settings-valid-targets'
import { UNIT_LIMITS } from '@/constants/units'
import type {
  CombatSide,
  Unit,
  UnitAbility,
  UnitBaseType,
  UnitLocator,
  UnitState,
  UnitStats,
} from '@/types'

import { getOpponentSide } from '../../combat-side-state/combat-side-state'
import type {
  CombatMode,
  CombatStateData,
  RestrictionEntry,
  SideStateData,
  UnitAbilityRestrictions,
} from '../../combat-state/types'
import {
  clearReconstructCache,
  ensureUnitState,
  reconstructAllUnits,
  reconstructUnit,
  reconstructUnitsForType,
  resolveGlobalIndex,
  resolveUnitStats,
  tagUnit,
  totalCountForType,
} from '../../utils/compact-units'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
} from '../../utils/unit-variant'
import type { AbilitiesParams } from '../abilities-params'
import type {
  AbilityTiming,
  DeclaredSubtype,
  SideApi,
  SideReadApi,
  TriggerEvent,
} from '../types'

// ============================================================================
// HELPERS
// ============================================================================

function findUnitByPriorityInSide(
  sideState: SideStateData,
  priority: string[],
  participatingTypes?: ReadonlySet<UnitBaseType>,
): Unit | undefined {
  for (const variantId of priority) {
    const { type } = parseVariantId(variantId)
    if (participatingTypes && !participatingTypes.has(type)) continue
    const count = sideState.units[variantId]
    if (!count || count <= 0) continue

    // Direct lookup: reconstruct single unit for index 0 of this variant
    const stats = resolveUnitStats(sideState, variantId)
    if (!stats) continue
    const state = sideState.unitState[variantId]?.[0]
    const unit = reconstructUnit(stats, state, variantId)
    tagUnit(unit, { key: variantId, index: 0 })
    return unit
  }
  return undefined
}

function countUnitsInSide(
  sideState: SideStateData,
  filter?: UnitBaseType | UnitBaseType[],
): number {
  let total = 0
  const filterSet = filter
    ? typeof filter === 'string'
      ? new Set([filter])
      : new Set(filter)
    : undefined
  for (const [key, count] of Object.entries(sideState.units)) {
    if (count <= 0) continue
    if (filterSet) {
      const { type } = parseVariantId(key)
      if (!filterSet.has(type)) continue
    }
    total += count
  }
  return total
}

function getPendingHitsForSide(sideState: SideStateData): number {
  return sideState.hitPools.reduce((sum, pool) => sum + pool.hits, 0)
}

function isRestricted(
  sideState: SideStateData,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  unitType: UnitBaseType,
): boolean {
  const entries = sideState.unitAbilityRestrictions?.[layer]?.[ability]
  if (!entries) return false
  return entries.some(e => !e.unitType || e.unitType === unitType)
}

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const layerData = current[layer] ?? {}
  const entries = layerData[ability] ?? []
  const entry: RestrictionEntry = unitType ? { reason, unitType } : { reason }

  return {
    ...current,
    [layer]: {
      ...layerData,
      [ability]: [...entries, entry],
    },
  }
}

function removeRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
): UnitAbilityRestrictions | undefined {
  if (!restrictions) return undefined
  const layerData = restrictions[layer]
  if (!layerData) return restrictions
  const entries = layerData[ability]
  if (!entries) return restrictions

  const filtered = entries.filter(
    e => e.reason !== reason || e.unitType !== unitType,
  )

  const newLayerData = { ...layerData }
  if (filtered.length > 0) {
    newLayerData[ability] = filtered
  } else {
    delete newLayerData[ability]
  }

  const hasEntries = Object.keys(newLayerData).length > 0
  const result = {
    ...restrictions,
    [layer]: hasEntries ? newLayerData : undefined,
  }

  if (!result.lost && !result.cannotBeUsed) return undefined
  return result
}

function getParticipatingUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  combatModeOverride?: CombatMode,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  const mode = combatModeOverride ?? state.combatMode
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(sideState.units)) {
      if (sideState.units[key] <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }
  return mode === 'GROUND'
    ? ((settings.groundCombatParticipating as UnitBaseType[]) ?? [])
    : ((settings.spaceCombatParticipating as UnitBaseType[]) ?? [])
}

function getAllUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  combatModeOverride?: CombatMode,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(sideState.units)) {
      if (sideState.units[key] <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }
  const mode = combatModeOverride ?? state.combatMode
  const participating =
    mode === 'GROUND'
      ? ((settings.groundCombatParticipating as UnitBaseType[]) ?? [])
      : ((settings.spaceCombatParticipating as UnitBaseType[]) ?? [])
  const structures = (settings.structures as UnitBaseType[]) ?? []
  return [...new Set([...participating, ...structures])]
}

function getUnitVariantsForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  filter?: {
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  },
): string[] {
  let baseTypes = filter?.includeNonParticipating
    ? getAllUnitTypesForSide(state, side, filter?.combatMode)
    : getParticipatingUnitTypesForSide(state, side, filter?.combatMode)
  if (filter?.include) {
    const includeSet = new Set(filter.include)
    baseTypes = baseTypes.filter(t => includeSet.has(t))
  }
  if (filter?.exclude) {
    const excludeSet = new Set(filter.exclude)
    baseTypes = baseTypes.filter(t => !excludeSet.has(t))
  }
  const settings = state.abilities[side]['SETTINGS']
  const declaredSubtypes = (settings?.subtypes ?? []) as DeclaredSubtype[]
  const excludeSubtypeSet = filter?.excludeSubtypes
    ? new Set(filter.excludeSubtypes)
    : null

  // Filter out variant IDs already in baseTypes whose subtypes are excluded
  // (spaceCombatParticipating etc. may contain variant IDs from expandWithSubtypes)
  if (excludeSubtypeSet) {
    baseTypes = baseTypes.filter(t => {
      const { subtypes } = parseVariantId(t)
      return (
        subtypes.length === 0 || !subtypes.some(s => excludeSubtypeSet.has(s))
      )
    })
  }

  const baseSet = new Set<string>(baseTypes)
  const result: string[] = [...baseTypes]
  const addedSet = new Set<string>(baseTypes)
  for (const decl of declaredSubtypes) {
    if (excludeSubtypeSet?.has(decl.name)) continue
    const { type, subtypes: parentSubs } = parseVariantId(decl.unitType)
    if (!baseSet.has(decl.unitType) && !addedSet.has(decl.unitType)) continue
    if (excludeSubtypeSet && parentSubs.some(s => excludeSubtypeSet.has(s)))
      continue
    const variantId = makeVariantId(type, [...parentSubs, decl.name])
    if (addedSet.has(variantId)) continue
    result.push(variantId)
    addedSet.add(variantId)
  }
  return result
}

function resolveSettingsValidTargets(
  state: Readonly<CombatStateData>,
  side: CombatSide,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) return []
  return getSettingsValidTargets(settings, state.currentPhase.meta)
}

// ============================================================================
// SIDE API BUILDER
// ============================================================================

function buildSideApi(
  side: CombatSide,
  state: CombatStateData,
  abilityKey?: string,
  abilitiesParams?: AbilitiesParams,
): SideApi {
  const api: SideApi = {
    getFaction() {
      return state[side].faction
    },

    getUnits(unitType?: UnitBaseType) {
      const sideState = state[side]
      if (unitType !== undefined) {
        return reconstructUnitsForType(sideState, unitType)
      }
      return reconstructAllUnits(sideState)
    },

    hasUnit(unitType: UnitBaseType) {
      return totalCountForType(state[side].units, unitType) > 0
    },

    countUnits(filter?: UnitBaseType | UnitBaseType[]) {
      return countUnitsInSide(state[side], filter)
    },

    getPendingHits() {
      return getPendingHitsForSide(state[side])
    },

    getHitPoolValidTargets() {
      const pool = state[side].hitPools[0]
      if (pool && pool.validTargets.length > 0) return pool.validTargets
      return resolveSettingsValidTargets(state, side)
    },

    getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
      return getParticipatingUnitTypesForSide(state, side, options?.combatMode)
    },

    getUnitVariants(filter?: {
      include?: UnitBaseType[]
      exclude?: UnitBaseType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    }) {
      return getUnitVariantsForSide(state, side, filter)
    },

    getUnitVariantsOptions(filter?: {
      include?: UnitBaseType[]
      exclude?: UnitBaseType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    }) {
      return getUnitVariantsForSide(state, side, filter).map(id => ({
        label: getVariantDisplayName(id),
        value: id,
      }))
    },

    findUnitByPriority(priority: string[]) {
      const participating = new Set(
        getParticipatingUnitTypesForSide(state, side),
      )
      return findUnitByPriorityInSide(state[side], priority, participating)
    },

    getUnitStats(unitType: UnitBaseType) {
      return resolveUnitStats(state[side], unitType)
    },

    isUnitAbilityLost(ability: UnitAbility, unitType: UnitBaseType) {
      return isRestricted(state[side], 'lost', ability, unitType)
    },

    isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitBaseType) {
      return isRestricted(state[side], 'cannotBeUsed', ability, unitType)
    },

    getAbilityConfig(key: string) {
      return state.abilities[side][key]
    },

    destroyUnit(unitTypeOrUnit: UnitBaseType | UnitLocator): void {
      const sideState = state[side]
      const { key, subIndex } =
        typeof unitTypeOrUnit === 'string'
          ? resolveGlobalIndex(sideState, unitTypeOrUnit, 0)
          : { key: unitTypeOrUnit.key, subIndex: unitTypeOrUnit.index }
      if (!sideState.units[key] || sideState.units[key] <= 0) return
      if (abilitiesParams) {
        abilitiesParams._destroyed[side][key] =
          (abilitiesParams._destroyed[side][key] ?? 0) + 1
        abilitiesParams._destroyCount++
      }
      api.removeUnit({ key, index: subIndex })
    },

    removeUnit(unitTypeOrUnit: UnitBaseType | UnitLocator): void {
      const sideState = state[side]
      clearReconstructCache(sideState)
      const { key, subIndex } =
        typeof unitTypeOrUnit === 'string'
          ? resolveGlobalIndex(sideState, unitTypeOrUnit, 0)
          : { key: unitTypeOrUnit.key, subIndex: unitTypeOrUnit.index }
      if (!sideState.units[key] || sideState.units[key] <= 0) return

      sideState.units[key]--
      if (sideState.units[key] <= 0) {
        delete sideState.units[key]
        delete sideState.unitState[key]
      } else {
        const stateArr = sideState.unitState[key]
        if (stateArr && stateArr.length > 0) {
          stateArr.splice(Math.min(subIndex, stateArr.length - 1), 1)
          if (stateArr.length > sideState.units[key]) {
            stateArr.length = sideState.units[key]
          }
        }
      }
    },

    placeUnits(unitsToAdd: Partial<Record<UnitBaseType, number>>) {
      const sideState = state[side]
      clearReconstructCache(sideState)
      for (const [type, count] of Object.entries(unitsToAdd)) {
        const unitType = type as UnitBaseType
        if (!count || count <= 0) continue
        const existing = totalCountForType(sideState.units, unitType)
        const limit = UNIT_LIMITS[unitType]
        if (existing + count > limit) {
          console.warn(
            `Unit limit exceeded: ${unitType} has a maximum of ${limit}`,
          )
        }
        const allowed = Math.min(count, limit - existing)
        if (allowed <= 0) continue

        const prevCount = sideState.units[unitType] ?? 0
        sideState.units[unitType] = prevCount + allowed
        if (!sideState.unitState[unitType]) {
          sideState.unitState[unitType] = []
        }
        if (!sideState.unitStats[unitType]) {
          // Shouldn't happen, but fallback
          sideState.unitStats[unitType] = {}
        }

        // Queue invoke registration (flushed after produce completes)
        if (abilitiesParams) {
          abilitiesParams.queueUnitInvokes(side, unitType, prevCount, allowed)
        }
      }
    },

    modifyUnitType(key: string, updates: Partial<UnitStats>): void {
      const sideState = state[side]
      clearReconstructCache(sideState)

      const { type } = parseVariantId(key)
      const isVariantKey = key.includes(':')

      if (isVariantKey) {
        // Update just this variant's stats
        const hadAbilities = resolveUnitStats(sideState, key)?.ABILITIES
        if (sideState.unitStats[key]) {
          if (typeof sideState.unitStats[key] === 'function') {
            sideState.unitStats[key] = resolveUnitStats(sideState, key)!
          }
          Object.assign(sideState.unitStats[key], updates)
        }
        // Queue invoke registration if ABILITIES were just added
        const count = sideState.units[key] ?? 0
        if (
          !hadAbilities &&
          'ABILITIES' in updates &&
          abilitiesParams &&
          count > 0
        ) {
          abilitiesParams.queueUnitInvokes(side, key, 0, count)
        }
      } else {
        // Update all variant keys of this base type
        const hasAbilitiesUpdate = 'ABILITIES' in updates
        for (const vKey of Object.keys(sideState.units)) {
          const { type: vType } = parseVariantId(vKey)
          if (vType !== type) continue
          const hadAbilities =
            hasAbilitiesUpdate && resolveUnitStats(sideState, vKey)?.ABILITIES
          if (sideState.unitStats[vKey]) {
            if (typeof sideState.unitStats[vKey] === 'function') {
              sideState.unitStats[vKey] = resolveUnitStats(sideState, vKey)!
            }
            Object.assign(sideState.unitStats[vKey], updates)
          }
          // Queue invoke registration if ABILITIES were just added
          const count = sideState.units[vKey] ?? 0
          if (
            !hadAbilities &&
            hasAbilitiesUpdate &&
            abilitiesParams &&
            count > 0
          ) {
            abilitiesParams.queueUnitInvokes(side, vKey, 0, count)
          }
        }
        // Also update the base unitStats template
        if (sideState.unitStats[type]) {
          if (typeof sideState.unitStats[type] === 'function') {
            sideState.unitStats[type] = resolveUnitStats(sideState, type)!
          }
          Object.assign(sideState.unitStats[type], updates)
        }
      }
    },

    modifyUnitState(locator: UnitLocator, updates: Partial<UnitState>): void {
      const sideState = state[side]
      clearReconstructCache(sideState)
      const us = ensureUnitState(sideState, locator.key, locator.index)
      Object.assign(us, updates)
    },

    reduceHits(amount: number) {
      const sideState = state[side]
      if (sideState.hitPools.length === 0 || amount <= 0) return
      let remaining = amount
      for (const pool of sideState.hitPools) {
        const reduce = Math.min(remaining, pool.hits)
        pool.hits -= reduce
        remaining -= reduce
        if (remaining <= 0) break
      }
    },

    addHits(hits: number, validTargets: UnitBaseType[]) {
      if (hits === 0) return
      state[side].hitPools.push({ hits, validTargets })
    },

    setUnitAbilityLost(
      ability: UnitAbility,
      reason: string,
      unitType?: UnitBaseType,
    ) {
      const sideState = state[side]
      sideState.unitAbilityRestrictions = addRestrictionEntry(
        sideState.unitAbilityRestrictions,
        'lost',
        ability,
        reason,
        unitType,
      )
    },

    removeUnitAbilityLost(
      ability: UnitAbility,
      reason: string,
      unitType?: UnitBaseType,
    ) {
      const sideState = state[side]
      sideState.unitAbilityRestrictions = removeRestrictionEntry(
        sideState.unitAbilityRestrictions,
        'lost',
        ability,
        reason,
        unitType,
      )
    },

    setUnitAbilityCannotBeUsed(
      ability: UnitAbility,
      reason: string,
      unitType?: UnitBaseType,
    ) {
      const sideState = state[side]
      sideState.unitAbilityRestrictions = addRestrictionEntry(
        sideState.unitAbilityRestrictions,
        'cannotBeUsed',
        ability,
        reason,
        unitType,
      )
    },

    removeUnitAbilityCannotBeUsed(
      ability: UnitAbility,
      reason: string,
      unitType?: UnitBaseType,
    ) {
      const sideState = state[side]
      sideState.unitAbilityRestrictions = removeRestrictionEntry(
        sideState.unitAbilityRestrictions,
        'cannotBeUsed',
        ability,
        reason,
        unitType,
      )
    },

    addSubtype(
      variantId: string,
      subtype: string,
      statsFactory?: (parentStats: UnitStats) => UnitStats,
    ) {
      const sideState = state[side]
      clearReconstructCache(sideState)
      const { type, subtypes: currentSubtypes } = parseVariantId(variantId)

      // Find a matching key: variantId itself if it has count > 0,
      // otherwise the base type
      let sourceKey = variantId
      if (!sideState.units[sourceKey] || sideState.units[sourceKey] <= 0) {
        sourceKey = type
      }
      if (!sideState.units[sourceKey] || sideState.units[sourceKey] <= 0) return

      // Compute new key with added subtype
      const newSubtypes = [...currentSubtypes, subtype].sort()
      const newKey = makeVariantId(type, newSubtypes)
      if (newKey === sourceKey) return

      // Transfer one unit from source to new key
      sideState.units[sourceKey]--
      const sourceState = sideState.unitState[sourceKey]
      let transferredState: UnitState | undefined
      if (sourceState && sourceState.length > 0) {
        transferredState = sourceState.shift()
      }
      if (sideState.units[sourceKey] <= 0) {
        delete sideState.units[sourceKey]
        delete sideState.unitState[sourceKey]
      }

      // Add to new key
      sideState.units[newKey] = (sideState.units[newKey] ?? 0) + 1
      if (!sideState.unitState[newKey]) {
        sideState.unitState[newKey] = []
      }
      if (transferredState) {
        sideState.unitState[newKey].push(transferredState)
      }

      // Copy stats from source (or base type) to new key if not present
      if (!sideState.unitStats[newKey]) {
        if (statsFactory) {
          sideState.unitStats[newKey] = statsFactory
        } else {
          const sourceStats =
            resolveUnitStats(sideState, sourceKey) ??
            resolveUnitStats(sideState, type)
          if (sourceStats) {
            sideState.unitStats[newKey] = { ...sourceStats }
          }
        }
      }
    },

    removeSubtype(variantId: string, subtype: string) {
      const sideState = state[side]
      clearReconstructCache(sideState)
      const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)

      // Find a variant key that has the subtype
      let sourceKey: string | undefined
      for (const key of Object.keys(sideState.units)) {
        if (sideState.units[key] <= 0) continue
        const { type: kType, subtypes: kSubs } = parseVariantId(key)
        if (kType !== type) continue
        if (!kSubs.includes(subtype)) continue
        if (requiredSubtypes.every(s => kSubs.includes(s))) {
          sourceKey = key
          break
        }
      }
      if (!sourceKey) return

      const { subtypes: sourceSubs } = parseVariantId(sourceKey)
      const newSubtypes = sourceSubs.filter(s => s !== subtype)
      const newKey =
        newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type

      // Transfer one unit
      sideState.units[sourceKey]--
      const sourceState = sideState.unitState[sourceKey]
      let transferredState: UnitState | undefined
      if (sourceState && sourceState.length > 0) {
        transferredState = sourceState.shift()
      }
      if (sideState.units[sourceKey] <= 0) {
        delete sideState.units[sourceKey]
        delete sideState.unitState[sourceKey]
      }

      sideState.units[newKey] = (sideState.units[newKey] ?? 0) + 1
      if (!sideState.unitState[newKey]) {
        sideState.unitState[newKey] = []
      }
      if (transferredState) {
        sideState.unitState[newKey].push(transferredState)
      }
    },

    updateAbilityConfig(
      keyOrUpdates: string | Record<string, unknown>,
      maybeUpdates?: Record<string, unknown>,
    ) {
      const sideConfig = state.abilities[side]

      let targetKey: string
      let updates: Record<string, unknown>

      if (typeof keyOrUpdates === 'string') {
        targetKey = keyOrUpdates
        updates = maybeUpdates!
      } else {
        targetKey = abilityKey!
        updates = keyOrUpdates
      }

      if (!sideConfig[targetKey]) {
        sideConfig[targetKey] = {}
      }

      const oldIsEnabled = sideConfig[targetKey].isEnabled
      const oldUses = sideConfig[targetKey].uses

      for (const [key, value] of Object.entries(updates)) {
        sideConfig[targetKey][key] =
          typeof value === 'function'
            ? value(sideConfig[targetKey][key])
            : value
      }

      if (abilitiesParams) {
        // Sync invokes when isEnabled or uses changed
        if (
          sideConfig[targetKey].isEnabled !== oldIsEnabled ||
          sideConfig[targetKey].uses !== oldUses
        ) {
          abilitiesParams.syncInvokesForKey(side, targetKey, state)
        }

        // Reconcile SETTINGS when it's modified
        if (targetKey === 'SETTINGS') {
          abilitiesParams.reconcileSettingsOnDraft(state)
        }
      }
    },

    modifyHitValue(amount: number, target?: unknown): void {
      const sideState = state[side]
      if (!sideState.hitValueModifiers) {
        sideState.hitValueModifiers = []
      }
      const base = { amount, context: state.currentPhase.meta }

      if (target === undefined) {
        sideState.hitValueModifiers.push(base)
      } else if (typeof target === 'string') {
        sideState.hitValueModifiers.push({ ...base, unitType: target })
      } else if (
        typeof target === 'object' &&
        target !== null &&
        'exclude' in target
      ) {
        sideState.hitValueModifiers.push({
          ...base,
          excludeUnitTypes: (target as { exclude: string[] }).exclude,
        })
      } else {
        // UnitLocator — store directly
        const locator = target as UnitLocator
        sideState.hitValueModifiers.push({
          ...base,
          unitLocator: { key: locator.key, index: locator.index },
        })
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return api
}

// ============================================================================
// CONTEXT BUILDERS (used by abilities-tracker)
// ============================================================================

const noop = () => {}

export class AbilityContext {
  log: (...data: unknown[]) => void
  unitSource?: { unitType: UnitBaseType; unitIndex: number }

  _abilitiesParams!: AbilitiesParams

  private _side: CombatSide
  private _triggerCallback?: (event: TriggerEvent) => void
  private _draftState?: CombatStateData
  private _draftApi?: {
    own: SideReadApi | SideApi
    opponent: SideReadApi | SideApi
  }
  private _cachedState?: CombatStateData
  private _cachedApi?: { own: SideReadApi; opponent: SideReadApi }

  constructor(side: CombatSide) {
    this._side = side
    this.log = noop
  }

  get state(): CombatStateData {
    return this._draftState ?? this._abilitiesParams.combatState.data
  }

  get api(): { own: SideReadApi | SideApi; opponent: SideReadApi | SideApi } {
    if (this._draftApi) return this._draftApi
    const currentState = this.state
    if (currentState !== this._cachedState) {
      this._cachedState = currentState
      this._cachedApi = {
        own: buildSideApi(this._side, currentState),
        opponent: buildSideApi(getOpponentSide(this._side), currentState),
      }
    }
    return this._cachedApi!
  }

  upgradeForCall(
    draft: CombatStateData,
    abilityKey: string,
    log: (...data: unknown[]) => void,
    triggerCallback: (event: TriggerEvent) => void,
  ) {
    this._draftState = draft
    this.log = log
    this._triggerCallback = triggerCallback
    this._draftApi = {
      own: buildSideApi(this._side, draft, abilityKey, this._abilitiesParams),
      opponent: buildSideApi(
        getOpponentSide(this._side),
        draft,
        abilityKey,
        this._abilitiesParams,
      ),
    }
  }

  resetAfterCall() {
    this._draftState = undefined
    this._draftApi = undefined
    this.log = noop
    this._triggerCallback = undefined
  }

  trigger(name: TriggerEvent['name'], context: unknown): void {
    if (this._triggerCallback) {
      this._triggerCallback({ name, side: this._side, context })
    }
  }

  getUnit(): UnitLocator {
    if (!this.unitSource) {
      throw new Error('getUnit() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key, subIndex } = resolveGlobalIndex(
      sideState,
      this.unitSource.unitType,
      this.unitSource.unitIndex,
    )
    return { key, index: subIndex }
  }

  getUnitState(): Readonly<UnitState> {
    if (!this.unitSource) {
      throw new Error('getUnitState() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key, subIndex } = resolveGlobalIndex(
      sideState,
      this.unitSource.unitType,
      this.unitSource.unitIndex,
    )
    return sideState.unitState[key]?.[subIndex] ?? {}
  }

  getUnitStats(): Readonly<UnitStats> {
    if (!this.unitSource) {
      throw new Error('getUnitStats() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key } = resolveGlobalIndex(
      sideState,
      this.unitSource.unitType,
      this.unitSource.unitIndex,
    )
    return resolveUnitStats(sideState, key) ?? {}
  }

  getUnitType(): UnitBaseType {
    if (!this.unitSource) {
      throw new Error('getUnitType() can only be called from unit abilities')
    }
    return this.unitSource.unitType
  }

  getUnitIndex(): number {
    if (!this.unitSource) {
      throw new Error('getUnitIndex() can only be called from unit abilities')
    }
    return this.unitSource.unitIndex
  }

  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    return this._abilitiesParams.getAbilityKeysForTiming(this._side, timing)
  }
}
