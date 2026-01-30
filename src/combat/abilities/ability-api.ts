import { original } from 'immer'

import type { UnitAbilityKey, UnitType } from '@/types'

import {
  getOpponentSide,
  getSettingsValidTargets,
} from '../state/side-state-ops'
import type {
  AbilitiesConfig,
  CombatMode,
  CombatSide,
  CombatStateData,
  RestrictionEntry,
  SideState,
  Unit,
  UnitAbilityRestrictions,
  UnitState,
} from '../state/types'
import {
  makeVariantId,
  parseVariantId,
  unitMatchesVariant,
} from '../utils/unit-variant'
import type {
  AbilityReadContext,
  DeclaredSubtype,
  SideApi,
  SideReadApi,
} from './types'

// ============================================================================
// HELPERS
// ============================================================================

function findUnitInSide(
  sideState: SideState,
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
  sideState: SideState,
  priority: string[],
): Unit | undefined {
  for (const variantId of priority) {
    const { type } = parseVariantId(variantId)
    const units = sideState.units[type]
    if (!units) continue

    for (let i = 0; i < units.length; i++) {
      if (unitMatchesVariant(units[i], variantId)) {
        // Use original() to unwrap Immer proxy so the reference matches
        // the one stored in DieValue by collectDice
        return original(units[i]) ?? units[i]
      }
    }
  }
  return undefined
}

function countUnitsInSide(
  sideState: SideState,
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

function getPendingHitsForSide(sideState: SideState): number {
  return sideState.hitPools.reduce((sum, pool) => sum + pool.hits, 0)
}

function isRestricted(
  sideState: SideState,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
  unitType: UnitType,
): boolean {
  const entries = sideState.unitAbilityRestrictions?.[layer]?.[ability]
  if (!entries) return false
  return entries.some(e => !e.unitType || e.unitType === unitType)
}

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbilityKey,
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
  ability: UnitAbilityKey,
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

function resolveSettingsParams(
  state: Readonly<CombatStateData>,
  side: CombatSide,
): Record<string, unknown> | undefined {
  const sideConfig = state.abilities[side]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (sideConfig.abilities as any[]).find(
    (a: { key: string }) => a.key === 'SETTINGS',
  )
  if (!settings) return undefined
  return {
    ...settings.defaultParams,
    ...sideConfig.config?.['SETTINGS'],
  }
}

function getParticipatingUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
): UnitType[] {
  const sideState = state[side]
  const params = resolveSettingsParams(state, side)
  if (!params) {
    return (Object.keys(sideState.units) as UnitType[]).filter(
      t => (sideState.units[t]?.length ?? 0) > 0,
    )
  }
  const units =
    state.combatMode === 'GROUND'
      ? ((params.groundCombatParticipating as UnitType[]) ?? [])
      : ((params.spaceCombatParticipating as UnitType[]) ?? [])
  return units
}

function getParticipatingVariantsForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
  },
): string[] {
  let baseTypes = getParticipatingUnitTypesForSide(state, side)
  if (filter?.include) {
    const includeSet = new Set(filter.include)
    baseTypes = baseTypes.filter(t => includeSet.has(t))
  }
  if (filter?.exclude) {
    const excludeSet = new Set(filter.exclude)
    baseTypes = baseTypes.filter(t => !excludeSet.has(t))
  }
  const params = resolveSettingsParams(state, side)
  const declaredSubtypes = (params?.declaredSubtypes ?? []) as DeclaredSubtype[]

  const baseSet = new Set(baseTypes)
  const result: string[] = [...baseTypes]
  for (const decl of declaredSubtypes) {
    if (!baseSet.has(decl.unitType)) continue
    result.push(makeVariantId(decl.unitType, [decl.name]))
  }
  return result
}

function resolveSettingsValidTargets(
  state: Readonly<CombatStateData>,
  side: CombatSide,
): UnitType[] {
  const params = resolveSettingsParams(state, side)
  if (!params) return []
  return getSettingsValidTargets(
    params,
    state.currentPhase.meta,
    state.combatMode,
  )
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

    getParticipatingUnitTypes() {
      return getParticipatingUnitTypesForSide(state, side)
    },

    getParticipatingVariants(filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
    }) {
      return getParticipatingVariantsForSide(state, side, filter)
    },

    findUnit(unitType: UnitType, predicate: Partial<UnitState>) {
      return findUnitInSide(sideState, unitType, predicate)
    },

    findUnitByPriority(priority: string[]) {
      return findUnitByPriorityInSide(sideState, priority)
    },

    isUnitAbilityLost(ability: UnitAbilityKey, unitType: UnitType) {
      return isRestricted(sideState, 'lost', ability, unitType)
    },

    isUnitAbilityCannotBeUsed(ability: UnitAbilityKey, unitType: UnitType) {
      return isRestricted(sideState, 'cannotBeUsed', ability, unitType)
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

    destroyUnit(unitTypeOrTypes: UnitType | UnitType[], index?: number): void {
      const sideState = draft[side]

      if (Array.isArray(unitTypeOrTypes)) {
        // destroyUnit(unitTypes[]) — destroy first of each type
        for (const unitType of unitTypeOrTypes) {
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

      const unitType = unitTypeOrTypes
      const units = sideState.units[unitType]
      if (!units) return

      const idx = index ?? 0
      if (idx < 0 || idx >= units.length) return

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
        for (let i = 0; i < count; i++) {
          sideState.units[unitType]!.push({})
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
          // modifyUnit(unitType, updates) — first of type
          const unit = units[0]
          if (unit) {
            Object.assign(unit, indexOrUpdates)
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
      ability: UnitAbilityKey,
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
      ability: UnitAbilityKey,
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
      ability: UnitAbilityKey,
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
      ability: UnitAbilityKey,
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

    addSubtype(unitType: UnitType, index: number, subtype: string) {
      const units = draft[side].units[unitType]
      if (!units?.[index]) return
      const unit = units[index]
      const existing = unit.subtypes ?? []
      if (!existing.includes(subtype)) {
        unit.subtypes = [...existing, subtype].sort()
      }
    },

    removeSubtype(unitType: UnitType, index: number, subtype: string) {
      const units = draft[side].units[unitType]
      if (!units?.[index]) return
      const unit = units[index]
      if (!unit.subtypes) return
      unit.subtypes = unit.subtypes.filter(s => s !== subtype)
      if (unit.subtypes.length === 0) delete unit.subtypes
    },

    updateAbilityConfig(
      keyOrUpdates: string | Record<string, unknown>,
      maybeUpdates?: Record<string, unknown>,
    ) {
      const sideAbilities = draft.abilities[side]
      if (!sideAbilities.config) {
        sideAbilities.config = {}
      }

      let targetKey: string
      let updates: Record<string, unknown>

      if (typeof keyOrUpdates === 'string') {
        targetKey = keyOrUpdates
        updates = maybeUpdates!
      } else {
        targetKey = abilityKey
        updates = keyOrUpdates
      }

      if (!sideAbilities.config[targetKey]) {
        sideAbilities.config[targetKey] = {}
      }
      Object.assign(sideAbilities.config[targetKey], updates)
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
) {
  return {
    state,
    api: {
      own: buildReadApi(side, state),
      opponent: buildReadApi(getOpponentSide(side), state),
    },
  }
}

export function buildCallContext(
  side: CombatSide,
  draft: CombatStateData,
  abilityKey: string,
  log?: (...data: unknown[]) => void,
) {
  return {
    state: draft,
    api: {
      own: buildApi(side, draft, abilityKey),
      opponent: buildApi(getOpponentSide(side), draft, abilityKey),
    },
    log: log ?? (() => {}),
  }
}

/** Build a read-only context for UI rendering (uiConfig functions) */
export function buildUIReadContext(
  side: CombatSide,
  attacker: SideState,
  defender: SideState,
  abilities: AbilitiesConfig,
  combatMode: CombatMode,
): AbilityReadContext {
  const meta = combatMode === 'GROUND' ? 'GROUND_COMBAT' : 'SPACE_COMBAT'
  const state: CombatStateData = {
    attacker,
    defender,
    abilities,
    combatMode,
    currentPhase: { meta, micro: 'START' },
  }
  return buildReadContext(side, state)
}
