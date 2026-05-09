import { TIMING_GROUPS } from '@/combat/abilities-engine/abilities-engine'
import {
  extractDefaults,
  extractSyncSources,
} from '@/combat/abilities-engine/declare-param'
import type {
  Ability,
  AbilityBaseParams,
  DeclaredSubtype,
  ParamChange,
  SettingsParams,
  SyncSourceConfig,
} from '@/combat/abilities-engine/types'
import type {
  CombatMode,
  SideAbilitiesConfig,
} from '@/combat/combat-state/types'
import { GROUND_FORCES, SHIPS } from '@/constants/units'
import type { CombatSide, UnitBaseType } from '@/types'

import {
  expandWithSubtypes,
  reconcileStringParam,
  reconcileUnitListParam,
  sortBaseTypes,
} from './reconcile-helpers'

type AbilitiesConfig = Record<CombatSide, SideAbilitiesConfig>
type SideConfig = SideAbilitiesConfig

/** Tracks the last-seen valid list per sync-source param, so reconciliation
 *  can distinguish "user unchecked this" from "genuinely new item." */
export type SyncSnapshots = Map<string, string[]>

// ── Sync-source reconciliation helpers ────────────────────────────────────

function resolveSettings(
  abilities: Ability[],
  config: SideConfig,
): { settings: SettingsParams; subtypes: DeclaredSubtype[] } {
  const settingsAbility = abilities.find(a => a.key === 'SETTINGS')
  const settings = {
    ...(settingsAbility ? extractDefaults(settingsAbility) : undefined),
    ...config['SETTINGS'],
  } as SettingsParams
  const subtypes = settings.subtypes ?? []
  return { settings, subtypes }
}

function buildValidList(
  config: SyncSourceConfig,
  ownSettings: SettingsParams,
  opponentSettings: SettingsParams,
  ownSubtypes: DeclaredSubtype[],
  opponentSubtypes: DeclaredSubtype[],
): string[] {
  const settings = config.side === 'own' ? ownSettings : opponentSettings
  const allSubtypes = config.side === 'own' ? ownSubtypes : opponentSubtypes
  const subtypes = config.includeNonParticipating
    ? allSubtypes
    : allSubtypes.filter(s => s.participating !== false)
  const group = settings[config.group] as UnitBaseType[]
  const sorted = sortBaseTypes(group, config.sort)
  return expandWithSubtypes(sorted, subtypes, config.sort)
}

// ── Pure reconcile functions ────────────────────────────────────────────

/**
 * Initialize defaults for abilities that declare params but don't
 * yet have entries in the config.
 */
export function initializeAbilityDefaults(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      const defaults = extractDefaults(ability)
      if (!config[side][ability.key] && defaults) {
        config[side][ability.key] = { ...defaults }
      }
    }
  }
}

/**
 * Main reconcile entry point: resets base groups, ensures consumer defaults,
 * syncs all sources, and reconciles ability order.
 */
export function reconcileAbilitiesConfig(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
  combatMode: CombatMode,
  syncSnapshots?: SyncSnapshots,
): void {
  resetBaseGroups(config, abilities)
  ensureConsumerDefaults(config, abilities)
  reconcileSyncAll(config, abilities, syncSnapshots)
  reconcileAbilityOrder(config, abilities, combatMode)
}

/**
 * Reset SETTINGS ships/groundForces/subtypes to base constants,
 * apply group additions from declareParamChange, and recompute
 * derived params via onParamSet.
 */
function resetBaseGroups(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]

    if (!config[side]['SETTINGS']) config[side]['SETTINGS'] = {}
    const settingsAbility = sideAbilities.find(a => a.key === 'SETTINGS')

    // Ensure all SETTINGS defaults are present (e.g. validTargetsSpaceCannonOffense)
    if (settingsAbility) {
      const defaults = extractDefaults(settingsAbility)
      for (const key of Object.keys(defaults)) {
        if (!(key in config[side]['SETTINGS']))
          config[side]['SETTINGS'][key] = defaults[key]
      }
    }

    const settings = config[side]['SETTINGS'] as SettingsParams
    settings.ships = [...SHIPS]
    settings.groundForces = [...GROUND_FORCES]
    settings.subtypes = []

    // Two passes: first builds groups (groundForces, etc.),
    // second resolves cross-group deps (e.g. Alastor copies groundForces → ships)
    for (let pass = 0; pass < 2; pass++) {
      const changes = collectParamChanges(sideAbilities, config[side], settings)
      for (const change of changes) {
        const group = settings[change.key]
        if (!group.includes(change.value)) {
          group.push(change.value)
        }
      }
    }

    settings.subtypes = collectDeclaredSubtypes(sideAbilities, config[side])

    // Compute SETTINGS derived params via onParamSet
    if (settingsAbility?.onParamSet) {
      settingsAbility.onParamSet(settings, 'ships', settings.ships)
      settingsAbility.onParamSet(
        settings,
        'groundForces',
        settings.groundForces,
      )
    }
  }
}

/**
 * Ensure consumer abilities (those with sync-sources) have params
 * initialized from defaults. Also initializes SETTINGS defaults.
 */
function ensureConsumerDefaults(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (!extractSyncSources(ability)) continue
      const defaults = extractDefaults(ability)
      if (defaults) {
        config[side][ability.key] = {
          ...defaults,
          ...config[side][ability.key],
        }
      }
    }
  }
}

/**
 * Shared sync logic: reconcile SETTINGS computed params for both sides,
 * then reconcile consumer params with cross-side access.
 */
function reconcileSyncAll(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
  syncSnapshots?: SyncSnapshots,
): void {
  // Pass 1: Reconcile SETTINGS computed params for both sides
  // Must happen before consumers so cross-side sources
  // (e.g. Raid Formation reading opponent's nonFighterShips) see
  // computed values.
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const { settings, subtypes } = resolveSettings(sideAbilities, config[side])
    reconcileSyncSources(
      sideAbilities.filter(a => a.key === 'SETTINGS'),
      config[side],
      settings,
      settings,
      subtypes,
      subtypes,
      side,
      syncSnapshots,
    )
  }

  // Pass 2: Reconcile consumer abilities with fresh cross-side settings
  for (const side of ['attacker', 'defender'] as const) {
    const oppSide = side === 'attacker' ? 'defender' : 'attacker'
    const sideAbilities = abilities[side]
    const { settings: ownSettings, subtypes: ownSubtypes } = resolveSettings(
      sideAbilities,
      config[side],
    )
    const { settings: oppSettings, subtypes: oppSubtypes } = resolveSettings(
      abilities[oppSide],
      config[oppSide],
    )
    reconcileSyncSources(
      sideAbilities.filter(a => a.key !== 'SETTINGS'),
      config[side],
      ownSettings,
      oppSettings,
      ownSubtypes,
      oppSubtypes,
      side,
      syncSnapshots,
    )
  }
}

/**
 * Reconcile ABILITY_ORDER params: keep only keys for abilities that are
 * enabled and have matching invokes, preserving user-chosen order.
 */
function reconcileAbilityOrder(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
  combatMode: CombatMode,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const sideConfig = config[side]

    if (!sideConfig['ABILITY_ORDER']) {
      sideConfig['ABILITY_ORDER'] = { isEnabled: true, uses: Infinity }
    } else if (Object.isFrozen(sideConfig['ABILITY_ORDER'])) {
      sideConfig['ABILITY_ORDER'] = { ...sideConfig['ABILITY_ORDER'] }
    }
    const orderConfig = sideConfig['ABILITY_ORDER']

    for (const group of TIMING_GROUPS) {
      const timingSet = new Set(group.timings)
      const validKeys: string[] = []

      for (const ability of sideAbilities) {
        if (ability.key === 'ABILITY_ORDER') continue
        if (ability.context && ability.context !== combatMode) continue
        const abilityConfig = sideConfig[ability.key] ?? ability.params
        if ('isEnabled' in abilityConfig && !abilityConfig.isEnabled) continue
        if (
          'uses' in abilityConfig &&
          typeof abilityConfig.uses === 'number' &&
          isFinite(abilityConfig.uses) &&
          abilityConfig.uses <= 0
        )
          continue
        const hasMatchingInvoke = ability.invoke.some(inv =>
          timingSet.has(inv.timing),
        )
        if (hasMatchingInvoke) {
          validKeys.push(ability.key)
        }
      }

      const currentOrder =
        (orderConfig[group.paramKey] as [string][] | undefined) ?? []
      orderConfig[group.paramKey] = reconcileUnitListParam(
        currentOrder,
        validKeys,
      )
    }
  }
}

function collectParamChanges(
  abilities: readonly Ability[],
  params: Record<string, Record<string, unknown>>,
  settings: SettingsParams,
): ParamChange[] {
  const result: ParamChange[] = []

  for (const ability of abilities) {
    if (!ability.declareParamChange) continue

    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }

    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareParamChange(abilityParams, settings)
    for (const change of declared) {
      result.push(change)
    }
  }

  return result
}

function collectDeclaredSubtypes(
  abilities: readonly Ability[],
  params: Record<string, Record<string, unknown>>,
): DeclaredSubtype[] {
  const result: DeclaredSubtype[] = []

  for (const ability of abilities) {
    if (!ability.declareSubtype) continue

    const abilityParams = {
      ...extractDefaults(ability),
      ...params[ability.key],
    }

    if (ability.headerUI) {
      const headerValue = abilityParams[ability.headerUI]
      if (!headerValue) continue
    }

    const declared = ability.declareSubtype(
      abilityParams as AbilityBaseParams & Record<string, unknown>,
    )
    for (const decl of declared) {
      const stamped = { ...decl, source: ability.key }
      if (
        !result.some(
          d =>
            d.source === stamped.source &&
            d.name === stamped.name &&
            d.unitType === stamped.unitType,
        )
      ) {
        result.push(stamped)
      }
    }
  }

  return result
}

function reconcileSyncSources(
  abilities: readonly Ability[],
  params: Record<string, Record<string, unknown>>,
  ownSettings: SettingsParams,
  opponentSettings: SettingsParams,
  ownSubtypes: DeclaredSubtype[],
  opponentSubtypes: DeclaredSubtype[],
  side: CombatSide,
  syncSnapshots?: SyncSnapshots,
): void {
  for (const ability of abilities) {
    const syncSources = extractSyncSources(ability)
    if (!syncSources) continue

    let abilityParams = params[ability.key]
    if (!abilityParams) continue

    if (Object.isFrozen(abilityParams)) {
      abilityParams = { ...abilityParams }
      params[ability.key] = abilityParams
    }

    for (const config of syncSources) {
      if (config.compute) {
        const settings = config.side === 'own' ? ownSettings : opponentSettings
        abilityParams[config.key] = config.compute(settings[config.group])
        continue
      }

      let validList = buildValidList(
        config,
        ownSettings,
        opponentSettings,
        ownSubtypes,
        opponentSubtypes,
      )

      if (config.filter) {
        validList = validList.filter(config.filter)
      }

      const currentValue = abilityParams[config.key]

      if (Array.isArray(currentValue)) {
        abilityParams[config.key] = reconcileUnitListParam(
          currentValue as ([string] | [string, unknown])[],
          validList,
          config.defaultItemValue,
        )
        if (syncSnapshots) {
          const snapshotKey = `${side}:${ability.key}:${config.key}`
          syncSnapshots.set(snapshotKey, validList)
        }
      } else if (typeof currentValue === 'string') {
        abilityParams[config.key] = reconcileStringParam(
          currentValue,
          validList,
        )
      }
    }
  }
}

// ── fromConfig helpers ───────────────────────────────────────────────────

/**
 * Snapshot consumer params (everything except SETTINGS) so they can
 * be restored after reconcile overwrites them.
 */
export function snapshotConsumerParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
): Record<CombatSide, Record<string, Record<string, unknown>>> {
  const saved: Record<CombatSide, Record<string, Record<string, unknown>>> = {
    attacker: {},
    defender: {},
  }
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (ability.key === 'SETTINGS') continue
      const params = config[side][ability.key]
      if (params) {
        saved[side][ability.key] = { ...params }
      }
    }
  }
  return saved
}

/**
 * Restore consumer params that reconcile overwrote.
 */
export function restoreConsumerParams(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
  saved: Record<CombatSide, Record<string, Record<string, unknown>>>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const ability of abilities[side]) {
      if (ability.key === 'SETTINGS') continue
      const userParams = saved[side][ability.key]
      if (!userParams) continue
      const synced = config[side][ability.key]
      if (!synced) continue
      Object.assign(synced, userParams)
    }
  }
}

// ── Simulation-path helpers ─────────────────────────────────────────────

/**
 * Reset SETTINGS to base groups (no group additions) and recompute
 * derived params. Subtypes from declareParamChange are preserved.
 * Does not touch consumer params.
 */
export function resetSettingsToBase(
  config: AbilitiesConfig,
  abilities: Record<CombatSide, Ability[]>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideAbilities = abilities[side]
    const settings = config[side]['SETTINGS'] as SettingsParams | undefined
    if (!settings) continue

    settings.ships = [...SHIPS]
    settings.groundForces = [...GROUND_FORCES]
    settings.subtypes = collectDeclaredSubtypes(sideAbilities, config[side])

    // Compute SETTINGS derived params via onParamSet
    const settingsAbility = sideAbilities.find(a => a.key === 'SETTINGS')
    if (settingsAbility?.onParamSet) {
      settingsAbility.onParamSet(settings, 'ships', settings.ships)
      settingsAbility.onParamSet(
        settings,
        'groundForces',
        settings.groundForces,
      )
    }
  }
}
