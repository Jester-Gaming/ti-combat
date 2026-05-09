import type {
  Ability,
  SettingsParams,
  SyncSortSpec,
  SyncSourceConfig,
} from './types'

const DECLARED_PARAM = Symbol('declaredParam')

interface DeclaredParamOptions<
  T,
  K extends keyof SettingsParams = keyof SettingsParams,
> {
  default: T
  source?: K
  side?: 'own' | 'opponent'
  sort?: SyncSortSpec
  /** For `UnitList<V>` params, the value used when reconcile adds a new
   *  entry that has no parent in the current list (e.g. `false` for
   *  checkbox lists, `0` for number lists). Subtype variants
   *  (`DREADNOUGHT:Galvanized`) inherit their parent's value when the
   *  parent is present, falling back to this only when there is no
   *  parent. Omit for order-mode lists (single-element tuples). */
  defaultItemValue?: unknown
  compute?: (value: SettingsParams[K]) => T
  filter?: (value: SettingsParams[K][number]) => boolean
  /** When true, the synced valid list includes declared subtypes whose
   *  `participating` is false. Default: false. */
  includeNonParticipating?: boolean
}

interface DeclaredParamValue<T> {
  [DECLARED_PARAM]: true
  default: T
  source?: keyof SettingsParams
  side: 'own' | 'opponent'
  sort: SyncSortSpec
  defaultItemValue?: unknown
  compute?: (value: SettingsParams[keyof SettingsParams]) => T
  filter?: (value: string) => boolean
  includeNonParticipating?: boolean
}

/**
 * Mark a param as synced from a SETTINGS group.
 * Returns `T` at the type level so `params` matches the `Params` generic.
 */
export function declareParam<
  T,
  K extends keyof SettingsParams = keyof SettingsParams,
>(options: DeclaredParamOptions<T, K>): T {
  return {
    [DECLARED_PARAM]: true,
    default: options.default,
    source: options.source,
    side: options.side ?? 'own',
    sort: options.sort ?? 'price-asc',
    defaultItemValue: options.defaultItemValue,
    compute: options.compute,
    filter: options.filter,
    includeNonParticipating: options.includeNonParticipating,
  } as unknown as T
}

export function isDeclaredParam(
  value: unknown,
): value is DeclaredParamValue<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as DeclaredParamValue<unknown>)[DECLARED_PARAM] === true
  )
}

/**
 * Extract plain default values from an ability's `params`.
 * DeclaredParam values are unwrapped to their `.default`.
 * Results are cached per ability instance (ability objects are stable).
 */
const defaultsCache = new WeakMap<Ability, Record<string, unknown>>()

export function extractDefaults(ability: Ability): Record<string, unknown> {
  const cached = defaultsCache.get(ability)
  if (cached) return cached

  const raw = ability.params
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = isDeclaredParam(value) ? value.default : value
  }

  defaultsCache.set(ability, result)
  return result
}

/**
 * Extract SyncSourceConfig[] from DeclaredParam entries with `.source`.
 */
export function extractSyncSources(
  ability: Ability,
): SyncSourceConfig[] | undefined {
  const raw = ability.params

  const result: SyncSourceConfig[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (isDeclaredParam(value) && value.source) {
      result.push({
        key,
        group: value.source,
        side: value.side,
        sort: value.sort,
        defaultItemValue: value.defaultItemValue,
        compute: value.compute,
        filter: value.filter,
        includeNonParticipating: value.includeNonParticipating,
      })
    }
  }
  return result.length > 0 ? result : undefined
}
