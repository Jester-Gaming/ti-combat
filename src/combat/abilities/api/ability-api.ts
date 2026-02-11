import type {
  CombatSide,
  Unit,
  UnitAbility,
  UnitState,
  UnitType,
} from '@/types'

/** Identifies the unit a unit-ability is attached to */
export interface UnitAbilitySource {
  unitType: UnitType
  unitIndex: number
}

import { getSettingsValidTargets } from '@/combat/combat-side-state/utils/get-settings-valid-targets'

import { getOpponentSide } from '../../combat-side-state/combat-side-state'
import type {
  CombatMode,
  CombatStateData,
  RestrictionEntry,
  SideStateData,
  UnitAbilityRestrictions,
} from '../../combat-state/types'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
  unitMatchesVariant,
} from '../../utils/unit-variant'
import type {
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
  const units = sideState.units[unitType]
  if (!units) return undefined

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
): Unit | undefined {
  for (const variantId of priority) {
    const { type } = parseVariantId(variantId)
    const units = sideState.units[type]
    if (!units) continue

    for (let i = 0; i < units.length; i++) {
      if (unitMatchesVariant(units[i], variantId)) {
        return units[i]
      }
    }
  }
  return undefined
}

function countUnitsInSide(
  sideState: SideStateData,
  filter?: ReadonlySet<UnitType>,
): number {
  let total = 0
  for (const [type, units] of Object.entries(sideState.units)) {
    if (!units) continue
    if (filter && !filter.has(type as UnitType)) continue
    total += units.length
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
    return (Object.keys(sideState.units) as UnitType[]).filter(
      t => (sideState.units[t]?.length ?? 0) > 0,
    )
  }
  return mode === 'GROUND'
    ? ((settings.groundCombatParticipating as UnitType[]) ?? [])
    : ((settings.spaceCombatParticipating as UnitType[]) ?? [])
}

function getParticipatingVariantsForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
  },
): string[] {
  let baseTypes = getParticipatingUnitTypesForSide(
    state,
    side,
    filter?.combatMode,
  )
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
        return sideState.units[unitType] ?? []
      }
      return sideState.units
    },

    hasUnit(unitType: UnitType) {
      const units = sideState.units[unitType]
      return !!units && units.length > 0
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

    getParticipatingVariants(filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
    }) {
      return getParticipatingVariantsForSide(state, side, filter)
    },

    getParticipatingVariantsOptions(filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      combatMode?: CombatMode
    }) {
      return getParticipatingVariantsForSide(state, side, filter).map(id => ({
        label: getVariantDisplayName(id),
        value: id,
      }))
    },

    findUnit(unitType: UnitType, predicate: Partial<UnitState>) {
      return findUnitInSide(sideState, unitType, predicate)
    },

    findUnitByPriority(priority: string[]) {
      return findUnitByPriorityInSide(sideState, priority)
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
// READ API (for isCallable — operates on readonly state)
// ============================================================================

export function buildReadApi(
  side: CombatSide,
  state: Readonly<CombatStateData>,
): SideReadApi {
  return buildSideReadApi(side, state as CombatStateData)
}

// ============================================================================
// WRITE API (for call — operates on Immer draft)
// ============================================================================

export function buildApi(
  side: CombatSide,
  draft: CombatStateData,
  abilityKey: string,
): SideApi {
  const api: SideApi = {
    ...buildSideReadApi(side, draft),

    destroyUnit(
      unitTypeOrTypesOrUnit: UnitType | UnitType[] | Unit,
      index?: number,
    ): void {
      const sideState = draft[side]

      if (Array.isArray(unitTypeOrTypesOrUnit)) {
        // destroyUnit(unitTypes[]) — destroy first of each type
        for (const unitType of unitTypeOrTypesOrUnit) {
          const units = sideState.units[unitType]
          if (units && units.length > 0) {
            units.splice(0, 1)
            if (units.length === 0) {
              delete sideState.units[unitType]
            }
          }
        }
        return
      }

      if (typeof unitTypeOrTypesOrUnit !== 'string') {
        // destroyUnit(unit) — by unit reference
        for (const [type, units] of Object.entries(sideState.units)) {
          if (!units) continue
          const idx = units.indexOf(unitTypeOrTypesOrUnit)
          if (idx !== -1) {
            units.splice(idx, 1)
            if (units.length === 0) {
              delete sideState.units[type as UnitType]
            }
            return
          }
        }
        return
      }

      const unitType = unitTypeOrTypesOrUnit
      const units = sideState.units[unitType]
      if (!units) return

      const idx = index ?? 0
      if (idx < 0 || idx >= units.length) return

      units.splice(idx, 1)
      if (units.length === 0) {
        delete sideState.units[unitType]
      }
    },

    removeUnit(unitTypeOrUnit: UnitType | Unit, index?: number): void {
      const sideState = draft[side]
      if (!sideState._removedUnits) {
        sideState._removedUnits = []
      }

      if (typeof unitTypeOrUnit !== 'string') {
        // removeUnit(unit) — by unit reference
        for (const [type, units] of Object.entries(sideState.units)) {
          if (!units) continue
          const idx = units.indexOf(unitTypeOrUnit)
          if (idx !== -1) {
            sideState._removedUnits.push({
              type: type as UnitType,
              unit: { ...unitTypeOrUnit },
            })
            units.splice(idx, 1)
            if (units.length === 0) {
              delete sideState.units[type as UnitType]
            }
            return
          }
        }
        return
      }

      const unitType = unitTypeOrUnit
      const units = sideState.units[unitType]
      if (!units) return

      const idx = index ?? 0
      if (idx < 0 || idx >= units.length) return

      sideState._removedUnits.push({
        type: unitType,
        unit: { ...units[idx] },
      })
      units.splice(idx, 1)
      if (units.length === 0) {
        delete sideState.units[unitType]
      }
    },

    addUnit(unitsToAdd: Partial<Record<UnitType, number>>) {
      const sideState = draft[side]
      for (const [type, count] of Object.entries(unitsToAdd)) {
        const unitType = type as UnitType
        if (!count || count <= 0) continue
        if (!sideState.units[unitType]) {
          sideState.units[unitType] = []
        }
        const template = sideState.unitStats?.[unitType]
        for (let i = 0; i < count; i++) {
          sideState.units[unitType]!.push({ ...template })
        }
      }
    },

    modifyUnit(
      unitTypeOrUnit: UnitType | Unit,
      indexOrUpdates: number | Partial<Unit>,
      maybeUpdates?: Partial<Unit>,
    ): void {
      const sideState = draft[side]

      if (typeof unitTypeOrUnit === 'string') {
        const unitType = unitTypeOrUnit
        const units = sideState.units[unitType]
        if (!units) return

        if (typeof indexOrUpdates === 'number') {
          // modifyUnit(unitType, index, updates)
          const unit = units[indexOrUpdates]
          if (unit && maybeUpdates) {
            Object.assign(unit, maybeUpdates)
          }
        } else {
          // modifyUnit(unitType, updates) — all of type + update template
          for (const unit of units) {
            Object.assign(unit, indexOrUpdates)
          }
          if (sideState.unitStats?.[unitType]) {
            Object.assign(sideState.unitStats[unitType]!, indexOrUpdates)
          }
        }
      } else {
        // modifyUnit(unit, updates) — unit ref from findUnit()
        const updates = indexOrUpdates as Partial<Unit>
        Object.assign(unitTypeOrUnit, updates)
      }
    },

    reduceHits(amount: number) {
      const sideState = draft[side]
      if (sideState.hitPools.length === 0 || amount <= 0) return
      sideState.hitPools[0].hits -= amount
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

    addSubtype(variantId: string, subtype: string) {
      const { type } = parseVariantId(variantId)
      const units = draft[side].units[type]
      if (!units) return
      const unit = units.find(u => unitMatchesVariant(u, variantId))
      if (!unit) return
      const existing = unit.subtypes ?? []
      if (!existing.includes(subtype)) {
        unit.subtypes = [...existing, subtype].sort()
      }
    },

    removeSubtype(variantId: string, subtype: string) {
      const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)
      const units = draft[side].units[type]
      if (!units) return
      const unit = units.find(u => {
        if (!u.subtypes?.includes(subtype)) return false
        return requiredSubtypes.every(s => u.subtypes!.includes(s))
      })
      if (!unit) return
      unit.subtypes = unit.subtypes!.filter(s => s !== subtype)
      if (unit.subtypes.length === 0) delete unit.subtypes
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

      for (const [key, value] of Object.entries(updates)) {
        sideConfig[targetKey][key] =
          typeof value === 'function'
            ? value(sideConfig[targetKey][key])
            : value
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return api
}

// ============================================================================
// CONTEXT BUILDERS (used by abilities-tracker)
// ============================================================================

export function buildReadContext(
  side: CombatSide,
  state: Readonly<CombatStateData>,
  unitSource?: UnitAbilitySource,
) {
  return {
    state,
    api: {
      own: buildReadApi(side, state),
      opponent: buildReadApi(getOpponentSide(side), state),
    },
    getUnit(): Unit {
      if (!unitSource) {
        throw new Error('getUnit() can only be called from unit abilities')
      }
      return state[side].units[unitSource.unitType]![unitSource.unitIndex]
    },
    getUnitType(): UnitType {
      if (!unitSource) {
        throw new Error('getUnitType() can only be called from unit abilities')
      }
      return unitSource.unitType
    },
    getUnitIndex(): number {
      if (!unitSource) {
        throw new Error('getUnitIndex() can only be called from unit abilities')
      }
      return unitSource.unitIndex
    },
  }
}

export function buildCallContext(
  side: CombatSide,
  draft: CombatStateData,
  abilityKey: string,
  log?: (...data: unknown[]) => void,
  unitSource?: UnitAbilitySource,
  triggerCallback?: (event: TriggerEvent) => void,
) {
  return {
    state: draft,
    api: {
      own: buildApi(side, draft, abilityKey),
      opponent: buildApi(getOpponentSide(side), draft, abilityKey),
    },
    log: log ?? (() => {}),
    trigger(name: TriggerEvent['name'], context: unknown): void {
      if (triggerCallback) {
        triggerCallback({ name, side, context })
      }
    },
    getUnit(): Unit {
      if (!unitSource) {
        throw new Error('getUnit() can only be called from unit abilities')
      }
      return draft[side].units[unitSource.unitType]![unitSource.unitIndex]
    },
    getUnitType(): UnitType {
      if (!unitSource) {
        throw new Error('getUnitType() can only be called from unit abilities')
      }
      return unitSource.unitType
    },
    getUnitIndex(): number {
      if (!unitSource) {
        throw new Error('getUnitIndex() can only be called from unit abilities')
      }
      return unitSource.unitIndex
    },
  }
}
