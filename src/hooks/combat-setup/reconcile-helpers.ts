import type { DeclaredSubtype } from '@/combat/abilities-engine/types'
import { makeVariantId, parseVariantId } from '@/combat/utils/unit-variant'
import { UNIT_PRICE } from '@/constants/units'
import type { UnitBaseType, UnitVariantId } from '@/types'

export function sortByPrice(
  types: UnitBaseType[],
  direction: 'asc' | 'desc',
): UnitBaseType[] {
  const sorted = [...types].sort((a, b) => UNIT_PRICE[a] - UNIT_PRICE[b])
  return direction === 'desc' ? sorted.reverse() : sorted
}

export function expandWithSubtypes(
  sortedTypes: UnitBaseType[],
  subtypes: DeclaredSubtype[],
): string[] {
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

  const result: string[] = []
  const seen = new Set<string>()
  for (const unitType of sortedTypes) {
    if (!seen.has(unitType)) {
      result.push(unitType)
      seen.add(unitType)
    }
    const subs = simpleByType.get(unitType)
    if (subs) {
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
      result.splice(parentIndex + 1, 0, variantId)
      seen.add(variantId)
    }
  }

  return result
}

export function reconcileArrayParam(
  current: string[],
  validList: string[],
): string[] {
  const validSet = new Set(validList)
  const currentSet = new Set(current)

  const kept = current.filter(item => validSet.has(item))
  const newItems = validList.filter(item => !currentSet.has(item))

  if (newItems.length === 0) return kept

  const result = [...kept]
  for (const newItem of newItems) {
    const validIndex = validList.indexOf(newItem)
    let insertAt = 0
    for (let i = 0; i < result.length; i++) {
      const resultItemValidIndex = validList.indexOf(result[i])
      if (resultItemValidIndex < validIndex) {
        insertAt = i + 1
      }
    }
    result.splice(insertAt, 0, newItem)
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
