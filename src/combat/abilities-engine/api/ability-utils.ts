import type { UnitList, UnitType } from '@/types'

/** Utility helpers exposed on `ctx.utils`. Convenience wrappers for the
 *  `UnitList<V>` shape used by ability params. */
export interface AbilityUtils {
  /** Flatten a `UnitList<V>` to plain keys. Filters out entries whose value
   *  slot is `false` (checkbox-mode disabled) or `0` (number-mode zero).
   *  Order-mode lists (single-element tuples) keep every key. */
  getFlat<K extends string = UnitType>(list: UnitList<never, K>): K[]
  getFlat<V extends boolean | number, K extends string = UnitType>(
    list: UnitList<V, K>,
  ): K[]
  /** Convert a checkbox/number `UnitList<V>` to a `Record<K, V>`. */
  getRecord<V extends boolean | number, K extends string = UnitType>(
    list: UnitList<V, K>,
  ): Record<K, V>
}

export const abilityUtils: AbilityUtils = {
  getFlat(list: readonly [string, ...unknown[]][]): string[] {
    const result: string[] = []
    for (const entry of list) {
      if (entry.length >= 2) {
        const v = entry[1]
        if (v === false || v === 0) continue
      }
      result.push(entry[0])
    }
    return result
  },
  getRecord(list: readonly [string, unknown][]): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [k, v] of list) result[k] = v
    return result
  },
} as AbilityUtils
