import type { Ability, SyncSourceConfig } from './types'

const DECLARED_PARAM = Symbol('declaredParam')

interface DeclaredParamOptions<T> {
  default: T
  source?: string
  side?: 'own' | 'opponent'
  sort?: 'asc' | 'desc'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compute?: (value: any) => T
  filter?: (value: string) => boolean
}

interface DeclaredParamValue<T> {
  [DECLARED_PARAM]: true
  default: T
  source?: string
  side: 'own' | 'opponent'
  sort: 'asc' | 'desc'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compute?: (value: any) => T
  filter?: (value: string) => boolean
}

/**
 * Mark a param as synced from a SETTINGS group.
 * Returns `T` at the type level so `params` matches the `Params` generic.
 */
export function declareParam<T>(options: DeclaredParamOptions<T>): T {
  return {
    [DECLARED_PARAM]: true,
    default: options.default,
    source: options.source,
    side: options.side ?? 'own',
    sort: options.sort ?? 'asc',
    compute: options.compute,
    filter: options.filter,
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
 */
export function extractDefaults(
  ability: Ability,
): Record<string, unknown> | undefined {
  const raw = ability.params
  if (!raw) return undefined

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[key] = isDeclaredParam(value) ? value.default : value
  }
  return result
}

/**
 * Extract SyncSourceConfig[] from DeclaredParam entries with `.source`.
 */
export function extractSyncSources(
  ability: Ability,
): SyncSourceConfig[] | undefined {
  const raw = ability.params
  if (!raw) return undefined

  const result: SyncSourceConfig[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (isDeclaredParam(value) && value.source) {
      result.push({
        key,
        group: value.source,
        side: value.side,
        sort: value.sort,
        compute: value.compute,
        filter: value.filter,
      })
    }
  }
  return result.length > 0 ? result : undefined
}
