import {
  type DeclaredSubtype,
  makeVariantId,
  parseVariantId,
  type SyncSortSpec,
} from '@/combat'
import { UNIT_PRICE, UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType, UnitVariantId } from '@/types'

export function sortBaseTypes(
  types: UnitBaseType[],
  sort: SyncSortSpec,
): UnitBaseType[] {
  if (typeof sort === 'function') return [...types].sort(sort)
  const compare =
    sort === 'price-asc' || sort === 'price-desc'
      ? (a: UnitBaseType, b: UnitBaseType) => UNIT_PRICE[a] - UNIT_PRICE[b]
      : (a: UnitBaseType, b: UnitBaseType) =>
          UNIT_TYPES.indexOf(a) - UNIT_TYPES.indexOf(b)
  const sorted = [...types].sort(compare)
  return sort === 'price-desc' || sort === 'normal-desc'
    ? sorted.reverse()
    : sorted
}

export function expandWithSubtypes(
  sortedTypes: UnitBaseType[],
  subtypes: DeclaredSubtype[],
  sort: SyncSortSpec = 'price-asc',
): string[] {
  // Custom comparators don't carry direction info — treat as ascending so
  // subtype variants follow their parent.
  const direction =
    typeof sort === 'function'
      ? 'asc'
      : sort === 'price-desc' || sort === 'normal-desc'
        ? 'desc'
        : 'asc'
  const simpleByType = new Map<UnitBaseType, DeclaredSubtype[]>()
  const compound: DeclaredSubtype[] = []

  for (const st of subtypes) {
    const { type, subtypes: parentSubs } = parseVariantId(st.unitType)
    if (parentSubs.length === 0) {
      const list = simpleByType.get(type)
      if (list) list.push(st)
      else simpleByType.set(type, [st])
    } else {
      compound.push(st)
    }
  }

  // Subtypes are treated as "better" variants: in desc (best-first) ordering
  // they appear before their parent; in asc they appear after.
  const subBeforeParent = direction === 'desc'

  const result: string[] = []
  const seen = new Set<string>()
  for (const unitType of sortedTypes) {
    const subs = simpleByType.get(unitType)
    if (subBeforeParent && subs) {
      for (const sub of subs) {
        const variantId = makeVariantId(sub.unitType, [
          sub.name as UnitVariantId,
        ])
        if (!seen.has(variantId)) {
          result.push(variantId)
          seen.add(variantId)
        }
      }
    }
    if (!seen.has(unitType)) {
      result.push(unitType)
      seen.add(unitType)
    }
    if (!subBeforeParent && subs) {
      for (const sub of subs) {
        const variantId = makeVariantId(sub.unitType, [
          sub.name as UnitVariantId,
        ])
        if (!seen.has(variantId)) {
          result.push(variantId)
          seen.add(variantId)
        }
      }
    }
  }

  for (const sub of compound) {
    if (!seen.has(sub.unitType)) continue
    const { type, subtypes: parentSubs } = parseVariantId(sub.unitType)
    const variantId = makeVariantId(type, [
      ...parentSubs,
      sub.name as UnitVariantId,
    ])
    if (!seen.has(variantId)) {
      const parentIndex = result.indexOf(sub.unitType)
      const insertAt = subBeforeParent ? parentIndex : parentIndex + 1
      result.splice(insertAt, 0, variantId)
      seen.add(variantId)
    }
  }

  return result
}

export function reconcileStringParam(
  current: string,
  validList: string[],
): string {
  if (validList.includes(current)) return current
  return validList[0] ?? current
}

type UnitListEntry = [string] | [string, unknown]

const NO_PARENT = Symbol('no-parent')

function inheritedValue(
  newKey: string,
  byKey: Map<string, unknown>,
): unknown | typeof NO_PARENT {
  // Walk parent chain by stripping ":subtype" segments so a freshly-added
  // variant inherits its base type's value (e.g. DREADNOUGHT:Galvanized
  // copies DREADNOUGHT's checkbox/number value).
  let key = newKey
  while (true) {
    const colonIdx = key.lastIndexOf(':')
    if (colonIdx === -1) return NO_PARENT
    key = key.slice(0, colonIdx)
    if (byKey.has(key)) return byKey.get(key)
  }
}

/** Reconcile a `UnitList<V>` (tuple-array) param against a fresh validList.
 *  - Drops entries whose key is no longer valid.
 *  - Preserves user-set order and per-key value for entries that survive.
 *  - Adds missing keys at their natural validList position. Subtype
 *    variants inherit their parent's value when the parent is present;
 *    otherwise the entry is built with `defaultItemValue` (or as a
 *    length-1 tuple `[key]` when `defaultItemValue` is omitted). */
export function reconcileUnitListParam(
  current: readonly (UnitListEntry | string)[],
  validList: readonly string[],
  defaultItemValue?: unknown,
): UnitListEntry[] {
  // Order-mode lists round-trip through the URL as flat string arrays —
  // normalize those to 1-tuples here so reconcile treats both shapes
  // identically (matches the runtime contract of `unwrapUnitListKeys`).
  const normalized: UnitListEntry[] = current.map(entry =>
    typeof entry === 'string' ? [entry] : (entry as UnitListEntry),
  )
  const validSet = new Set(validList)
  const kept = normalized.filter(entry => validSet.has(entry[0]))
  const keptKeys = new Set(kept.map(entry => entry[0]))
  const newKeys = validList.filter(key => !keptKeys.has(key))

  if (newKeys.length === 0)
    return kept.map(entry => [...entry] as UnitListEntry)

  const result: UnitListEntry[] = kept.map(entry => [...entry] as UnitListEntry)
  const valuesByKey = new Map<string, unknown>(
    kept.map(entry => [entry[0], entry[1]]),
  )

  for (const newKey of newKeys) {
    const validIndex = validList.indexOf(newKey)
    let insertAt = 0
    for (let i = 0; i < result.length; i++) {
      const itemValidIndex = validList.indexOf(result[i][0])
      if (itemValidIndex !== -1 && itemValidIndex < validIndex) {
        insertAt = i + 1
      }
    }
    const inherited = inheritedValue(newKey, valuesByKey)
    let entry: UnitListEntry
    if (inherited !== NO_PARENT) {
      entry = [newKey, inherited]
    } else if (defaultItemValue !== undefined) {
      entry = [newKey, defaultItemValue]
    } else {
      entry = [newKey]
    }
    result.splice(insertAt, 0, entry)
    valuesByKey.set(newKey, entry[1])
  }

  return result
}
