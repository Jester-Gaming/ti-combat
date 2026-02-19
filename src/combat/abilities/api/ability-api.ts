import { getSettingsValidTargets } from '@/combat/combat-side-state/utils/get-settings-valid-targets'
import { UNIT_LIMITS } from '@/constants/units'
import type {
  CombatSide,
  Unit,
  UnitAbility,
  UnitLocator,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'
import { UNIT_STATE_KEYS } from '@/types'

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
  Ability,
  AbilityReadContext,
  AbilityTiming,
  DeclaredSubtype,
  SideApi,
  SideReadApi,
  TriggerEvent,
} from '../types'

// ============================================================================
// HELPERS
// ============================================================================

function findUnitInSide(
  sideState: SideStateData,
  unitType: UnitType,
  predicate: Partial<UnitState>,
): { unit: Unit; index: number } | undefined {
  const units = reconstructUnitsForType(sideState, unitType)

  const index = units.findIndex(unit =>
    Object.entries(predicate).every(
      ([key, value]) => unit[key as keyof UnitState] === value,
    ),
  )

  return index >= 0 ? { unit: units[index], index } : undefined
}

function findUnitByPriorityInSide(
  sideState: SideStateData,
  priority: string[],
  participatingTypes?: ReadonlySet<UnitType>,
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
  filter?: ReadonlySet<UnitType>,
): number {
  let total = 0
  for (const [key, count] of Object.entries(sideState.units)) {
    if (count <= 0) continue
    if (filter) {
      const { type } = parseVariantId(key)
      if (!filter.has(type)) continue
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
  unitType: UnitType,
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
  unitType?: UnitType,
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
  unitType?: UnitType,
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
): UnitType[] {
  const settings = state.abilities[side]['SETTINGS']
  const mode = combatModeOverride ?? state.combatMode
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitType>()
    for (const key of Object.keys(sideState.units)) {
      if (sideState.units[key] <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }
  return mode === 'GROUND'
    ? ((settings.groundCombatParticipating as UnitType[]) ?? [])
    : ((settings.spaceCombatParticipating as UnitType[]) ?? [])
}

function getAllUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  combatModeOverride?: CombatMode,
): UnitType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitType>()
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
      ? ((settings.groundCombatParticipating as UnitType[]) ?? [])
      : ((settings.spaceCombatParticipating as UnitType[]) ?? [])
  const structures = (settings.structures as UnitType[]) ?? []
  return [...new Set([...participating, ...structures])]
}

function getUnitVariantsForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
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
): UnitType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) return []
  return getSettingsValidTargets(settings, state.currentPhase.meta)
}

// ============================================================================
// SHARED READ API BUILDER
// ============================================================================

function buildSideReadApi(
  side: CombatSide,
  state: CombatStateData,
): SideReadApi {
  const sideState = state[side]

  return {
    getFaction() {
      return sideState.faction
    },

    getUnits(unitType?: UnitType) {
      if (unitType !== undefined) {
        return reconstructUnitsForType(sideState, unitType)
      }
      return reconstructAllUnits(sideState)
    },

    hasUnit(unitType: UnitType) {
      return totalCountForType(sideState.units, unitType) > 0
    },

    countUnits(filter?: ReadonlySet<UnitType>) {
      return countUnitsInSide(sideState, filter)
    },

    getPendingHits() {
      return getPendingHitsForSide(sideState)
    },

    getHitPoolValidTargets() {
      const pool = sideState.hitPools[0]
      if (pool && pool.validTargets.length > 0) return pool.validTargets
      return resolveSettingsValidTargets(state, side)
    },

    getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
      return getParticipatingUnitTypesForSide(state, side, options?.combatMode)
    },

    getUnitVariants(filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    }) {
      return getUnitVariantsForSide(state, side, filter)
    },

    getUnitVariantsOptions(filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    }) {
      return getUnitVariantsForSide(state, side, filter).map(id => ({
        label: getVariantDisplayName(id),
        value: id,
      }))
    },

    findUnit(unitType: UnitType, predicate: Partial<UnitState>) {
      return findUnitInSide(sideState, unitType, predicate)
    },

    findUnitByPriority(priority: string[]) {
      const participating = new Set(
        getParticipatingUnitTypesForSide(state, side),
      )
      return findUnitByPriorityInSide(sideState, priority, participating)
    },

    getUnitStats(unitType: UnitType) {
      return resolveUnitStats(sideState, unitType)
    },

    isUnitAbilityLost(ability: UnitAbility, unitType: UnitType) {
      return isRestricted(sideState, 'lost', ability, unitType)
    },

    isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType) {
      return isRestricted(sideState, 'cannotBeUsed', ability, unitType)
    },

    getAbilityConfig(key: string) {
      return state.abilities[side][key]
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ============================================================================
// WRITE API (for call — operates on Immer draft)
// ============================================================================

export function buildApi(
  side: CombatSide,
  draft: CombatStateData,
  abilityKey: string,
  abilitiesParams?: AbilitiesParams,
): SideApi {
  const api: SideApi = {
    ...buildSideReadApi(side, draft),

    destroyUnit(
      unitTypeOrTypesOrUnit: UnitType | UnitType[] | UnitLocator,
      index?: number,
    ): void {
      const sideState = draft[side]
      clearReconstructCache(sideState)

      if (Array.isArray(unitTypeOrTypesOrUnit)) {
        // destroyUnit(unitTypes[]) — destroy first of each type
        for (const unitType of unitTypeOrTypesOrUnit) {
          // Find first variant key with count > 0 for this base type
          for (const key of Object.keys(sideState.units)) {
            const { type } = parseVariantId(key)
            if (type !== unitType) continue
            if (sideState.units[key] <= 0) continue
            if (abilitiesParams) {
              abilitiesParams._destroyed[side][key] =
                (abilitiesParams._destroyed[side][key] ?? 0) + 1
              abilitiesParams._destroyCount++
            }
            sideState.units[key]--
            if (sideState.units[key] <= 0) {
              delete sideState.units[key]
              delete sideState.unitState[key]
            } else {
              const stateArr = sideState.unitState[key]
              if (stateArr && stateArr.length > sideState.units[key]) {
                stateArr.splice(0, 1)
              }
            }
            break
          }
        }
        return
      }

      if (typeof unitTypeOrTypesOrUnit !== 'string') {
        // destroyUnit(locator) — by UnitLocator
        const { key, index: subIndex } = unitTypeOrTypesOrUnit
        if (sideState.units[key] && sideState.units[key] > 0) {
          if (abilitiesParams) {
            abilitiesParams._destroyed[side][key] =
              (abilitiesParams._destroyed[side][key] ?? 0) + 1
            abilitiesParams._destroyCount++
          }
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
        }
        return
      }

      // destroyUnit(unitType, index?) — by type + optional index
      const unitType = unitTypeOrTypesOrUnit
      const globalIdx = index ?? 0
      const { key, subIndex } = resolveGlobalIndex(
        sideState,
        unitType,
        globalIdx,
      )
      if (!sideState.units[key] || sideState.units[key] <= 0) return

      if (abilitiesParams) {
        abilitiesParams._destroyed[side][key] =
          (abilitiesParams._destroyed[side][key] ?? 0) + 1
        abilitiesParams._destroyCount++
      }
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

    removeUnit(unitTypeOrUnit: UnitType | UnitLocator, index?: number): void {
      const sideState = draft[side]
      clearReconstructCache(sideState)

      if (typeof unitTypeOrUnit !== 'string') {
        // removeUnit(locator) — by UnitLocator
        const { key, index: subIndex } = unitTypeOrUnit
        if (sideState.units[key] && sideState.units[key] > 0) {
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
        }
        return
      }

      const unitType = unitTypeOrUnit
      const globalIdx = index ?? 0
      const { key, subIndex } = resolveGlobalIndex(
        sideState,
        unitType,
        globalIdx,
      )
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

    addUnit(unitsToAdd: Partial<Record<UnitType, number>>) {
      const sideState = draft[side]
      clearReconstructCache(sideState)
      for (const [type, count] of Object.entries(unitsToAdd)) {
        const unitType = type as UnitType
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

    modifyUnit(
      unitTypeOrUnit: UnitType | string | Unit,
      indexOrUpdates: number | Partial<Unit>,
      maybeUpdates?: Partial<Unit>,
    ): void {
      const sideState = draft[side]
      clearReconstructCache(sideState)

      if (typeof unitTypeOrUnit === 'string') {
        const key = unitTypeOrUnit

        if (typeof indexOrUpdates === 'number') {
          // modifyUnit(unitType|variantKey, index, updates)
          const updates = maybeUpdates!
          const { type } = parseVariantId(key)
          const isVariantKey = key.includes(':')

          let resolvedKey: string
          let subIndex: number

          if (isVariantKey) {
            resolvedKey = key
            subIndex = indexOrUpdates
          } else {
            const resolved = resolveGlobalIndex(sideState, type, indexOrUpdates)
            resolvedKey = resolved.key
            subIndex = resolved.subIndex
          }

          // Split updates: state keys go to unitState, stats keys go to unitStats
          const stateUpdates: Partial<UnitState> = {}
          const statsUpdates: Partial<Unit> = {}
          let hasStateUpdates = false
          let hasStatsUpdates = false

          for (const [k, v] of Object.entries(updates)) {
            if (UNIT_STATE_KEYS.has(k)) {
              ;(stateUpdates as Record<string, unknown>)[k] = v
              hasStateUpdates = true
            } else {
              ;(statsUpdates as Record<string, unknown>)[k] = v
              hasStatsUpdates = true
            }
          }

          if (hasStateUpdates) {
            const us = ensureUnitState(sideState, resolvedKey, subIndex)
            Object.assign(us, stateUpdates)
          }

          if (hasStatsUpdates) {
            if (sideState.unitStats[resolvedKey]) {
              if (typeof sideState.unitStats[resolvedKey] === 'function') {
                sideState.unitStats[resolvedKey] = resolveUnitStats(
                  sideState,
                  resolvedKey,
                )!
              }
              Object.assign(sideState.unitStats[resolvedKey], statsUpdates)
            }
          }
        } else {
          // modifyUnit(unitType|variantKey, updates) — all of type + update template
          const updates = indexOrUpdates as Partial<Unit>
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
            // Update per-unit state for all units of this variant
            const count = sideState.units[key] ?? 0
            for (let i = 0; i < count; i++) {
              const stateUpdates: Partial<UnitState> = {}
              let hasStateUpdates = false
              for (const [k, v] of Object.entries(updates)) {
                if (UNIT_STATE_KEYS.has(k)) {
                  ;(stateUpdates as Record<string, unknown>)[k] = v
                  hasStateUpdates = true
                }
              }
              if (hasStateUpdates) {
                const us = ensureUnitState(sideState, key, i)
                Object.assign(us, stateUpdates)
              }
            }
            // Queue invoke registration if ABILITIES were just added
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
                hasAbilitiesUpdate &&
                resolveUnitStats(sideState, vKey)?.ABILITIES
              if (sideState.unitStats[vKey]) {
                if (typeof sideState.unitStats[vKey] === 'function') {
                  sideState.unitStats[vKey] = resolveUnitStats(sideState, vKey)!
                }
                Object.assign(sideState.unitStats[vKey], updates)
              }
              // Update per-unit state for all units of this variant
              const count = sideState.units[vKey] ?? 0
              for (let i = 0; i < count; i++) {
                const stateUpdates: Partial<UnitState> = {}
                let hasStateUpdates = false
                for (const [k, v] of Object.entries(updates)) {
                  if (UNIT_STATE_KEYS.has(k)) {
                    ;(stateUpdates as Record<string, unknown>)[k] = v
                    hasStateUpdates = true
                  }
                }
                if (hasStateUpdates) {
                  const us = ensureUnitState(sideState, vKey, i)
                  Object.assign(us, stateUpdates)
                }
              }
              // Queue invoke registration if ABILITIES were just added
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
        }
      } else {
        // modifyUnit(locator, updates) — by UnitLocator
        const updates = indexOrUpdates as Partial<Unit>
        const locator = unitTypeOrUnit as UnitLocator
        // Split state vs stats updates
        for (const [k, v] of Object.entries(updates)) {
          if (UNIT_STATE_KEYS.has(k)) {
            const us = ensureUnitState(sideState, locator.key, locator.index)
            ;(us as Record<string, unknown>)[k] = v
          } else {
            if (sideState.unitStats[locator.key]) {
              if (typeof sideState.unitStats[locator.key] === 'function') {
                sideState.unitStats[locator.key] = resolveUnitStats(
                  sideState,
                  locator.key,
                )!
              }
              ;(sideState.unitStats[locator.key] as Record<string, unknown>)[
                k
              ] = v
            }
          }
        }
      }
    },

    reduceHits(amount: number) {
      const sideState = draft[side]
      if (sideState.hitPools.length === 0 || amount <= 0) return
      let remaining = amount
      for (const pool of sideState.hitPools) {
        const reduce = Math.min(remaining, pool.hits)
        pool.hits -= reduce
        remaining -= reduce
        if (remaining <= 0) break
      }
    },

    addHits(hits: number, validTargets: UnitType[]) {
      if (hits === 0) return
      draft[side].hitPools.push({ hits, validTargets })
    },

    setUnitAbilityLost(
      ability: UnitAbility,
      reason: string,
      unitType?: UnitType,
    ) {
      const sideState = draft[side]
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
      unitType?: UnitType,
    ) {
      const sideState = draft[side]
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
      unitType?: UnitType,
    ) {
      const sideState = draft[side]
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
      unitType?: UnitType,
    ) {
      const sideState = draft[side]
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
      const sideState = draft[side]
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
      const sideState = draft[side]
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
      const sideConfig = draft.abilities[side]

      let targetKey: string
      let updates: Record<string, unknown>

      if (typeof keyOrUpdates === 'string') {
        targetKey = keyOrUpdates
        updates = maybeUpdates!
      } else {
        targetKey = abilityKey
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
          abilitiesParams.syncInvokesForKey(side, targetKey, draft)
        }

        // Reconcile SETTINGS when it's modified
        if (targetKey === 'SETTINGS') {
          abilitiesParams.reconcileSettingsOnDraft(draft)
        }
      }
    },

    modifyHitValue(amount: number, target?: unknown): void {
      const sideState = draft[side]
      if (!sideState.hitValueModifiers) {
        sideState.hitValueModifiers = []
      }
      const base = { amount, context: draft.currentPhase.meta }

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

export class AbilityContext {
  state: CombatStateData
  api: { own: SideReadApi | SideApi; opponent: SideReadApi | SideApi }
  log: (...data: unknown[]) => void

  private _side: CombatSide
  private _unitSource?: { unitType: UnitType; unitIndex: number }
  private _triggerCallback?: (event: TriggerEvent) => void
  private _abilities?: readonly Ability[]

  constructor(
    side: CombatSide,
    state: CombatStateData,
    unitSource?: { unitType: UnitType; unitIndex: number },
    abilities?: readonly Ability[],
  ) {
    this._side = side
    this.state = state
    this._unitSource = unitSource
    this._abilities = abilities
    this.log = () => {}
    this.api = {
      own: buildSideReadApi(side, state),
      opponent: buildSideReadApi(getOpponentSide(side), state),
    }
  }

  upgradeForCall(
    draft: CombatStateData,
    abilityKey: string,
    log: (...data: unknown[]) => void,
    triggerCallback: (event: TriggerEvent) => void,
    abilitiesParams: AbilitiesParams,
  ) {
    this.state = draft
    this.log = log
    this._triggerCallback = triggerCallback
    this.api = {
      own: buildApi(this._side, draft, abilityKey, abilitiesParams),
      opponent: buildApi(
        getOpponentSide(this._side),
        draft,
        abilityKey,
        abilitiesParams,
      ),
    }
  }

  trigger(name: TriggerEvent['name'], context: unknown): void {
    if (this._triggerCallback) {
      this._triggerCallback({ name, side: this._side, context })
    }
  }

  getUnit(): UnitLocator {
    if (!this._unitSource) {
      throw new Error('getUnit() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key, subIndex } = resolveGlobalIndex(
      sideState,
      this._unitSource.unitType,
      this._unitSource.unitIndex,
    )
    return { key, index: subIndex }
  }

  getUnitState(): Readonly<UnitState> {
    if (!this._unitSource) {
      throw new Error('getUnitState() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key, subIndex } = resolveGlobalIndex(
      sideState,
      this._unitSource.unitType,
      this._unitSource.unitIndex,
    )
    return sideState.unitState[key]?.[subIndex] ?? {}
  }

  getUnitStats(): Readonly<UnitStats> {
    if (!this._unitSource) {
      throw new Error('getUnitStats() can only be called from unit abilities')
    }
    const sideState = this.state[this._side]
    const { key } = resolveGlobalIndex(
      sideState,
      this._unitSource.unitType,
      this._unitSource.unitIndex,
    )
    return resolveUnitStats(sideState, key) ?? {}
  }

  getUnitType(): UnitType {
    if (!this._unitSource) {
      throw new Error('getUnitType() can only be called from unit abilities')
    }
    return this._unitSource.unitType
  }

  getUnitIndex(): number {
    if (!this._unitSource) {
      throw new Error('getUnitIndex() can only be called from unit abilities')
    }
    return this._unitSource.unitIndex
  }

  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    if (!this._abilities) return []
    const timings = Array.isArray(timing) ? timing : [timing]
    const sideConfig = this.state.abilities[this._side]
    const results: { key: string; name: string }[] = []
    for (const ability of this._abilities) {
      if (ability.key === 'ABILITY_ORDER') continue
      if (ability.context && ability.context !== this.state.combatMode) continue
      const config = sideConfig[ability.key] ?? ability.params
      if ('isEnabled' in config && !config.isEnabled) continue
      if (
        'uses' in config &&
        typeof config.uses === 'number' &&
        isFinite(config.uses as number) &&
        (config.uses as number) <= 0
      )
        continue
      const hasMatchingInvoke = ability.invoke.some(inv =>
        timings.includes(inv.timing),
      )
      if (hasMatchingInvoke) {
        results.push({ key: ability.key, name: ability.name })
      }
    }
    return results
  }
}

export function buildReadContext(
  side: CombatSide,
  state: Readonly<CombatStateData>,
  unitSource?: { unitType: UnitType; unitIndex: number },
  abilities?: readonly Ability[],
): AbilityReadContext {
  return new AbilityContext(
    side,
    state as CombatStateData,
    unitSource,
    abilities,
  ) as unknown as AbilityReadContext
}
