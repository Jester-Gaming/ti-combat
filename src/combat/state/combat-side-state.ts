import type { DieValue, UnitStats, UnitType } from '@/types'

import type { Unit } from '../types'
import type { HitPool, HitSource } from './hit-pool'
import { getValidTargets } from './hit-pool'

export const DEFAULT_UNIT_SACRIFICE_ORDER: UnitType[] = [
  'FIGHTER',
  'INFANTRY',
  'DESTROYER',
  'CRUISER',
  'CARRIER',
  'DREADNOUGHT',
  'MECH',
  'WAR_SUN',
  'FLAGSHIP',
]

/** Immutable combat side state with hit pool management */
export class CombatSideState {
  readonly stats: Partial<Record<UnitType, UnitStats>>
  private readonly _units: Partial<Record<UnitType, Unit[]>>
  private readonly _hitPools: HitPool[]

  constructor(
    stats: Partial<Record<UnitType, UnitStats>>,
    units: Partial<Record<UnitType, Unit[]>>,
    hitPools: HitPool[] = [],
  ) {
    this.stats = stats
    this._units = units
    this._hitPools = hitPools
  }

  get units(): Partial<Record<UnitType, Unit[]>> {
    return this._units
  }

  get hitPools(): readonly HitPool[] {
    return this._hitPools
  }

  /** Sum of all pending hits across all pools */
  get pendingHits(): number {
    return this._hitPools.reduce((sum, pool) => sum + pool.hits, 0)
  }

  /** Reduce hits from the first pool (mutable operation for ability calls) */
  reduceHits(amount: number): void {
    if (this._hitPools.length > 0 && amount > 0) {
      ;(this._hitPools[0] as { hits: number }).hits -= amount
    }
  }

  /** Collect dice for a specific combat phase, filtered by participating units */
  collectDice(
    source: HitSource,
    participatingUnits: ReadonlySet<UnitType>,
  ): DieValue[] {
    const diceByHitValue = new Map<number, number>()

    for (const [type, units] of Object.entries(this._units)) {
      if (!units || units.length === 0) continue
      if (!participatingUnits.has(type as UnitType)) continue

      const stats = this.stats[type as keyof typeof this.stats]
      if (!stats) continue

      const dieValue =
        source === 'COMBAT' ? stats.COMBAT : stats.ABILITIES?.[source]
      if (!dieValue) continue

      const [hitValue, dicePerUnit] = dieValue
      if (dicePerUnit <= 0) continue

      const totalDice = units.length * dicePerUnit
      const current = diceByHitValue.get(hitValue) ?? 0
      diceByHitValue.set(hitValue, current + totalDice)
    }

    return Array.from(diceByHitValue, ([hitValue, count]) => [hitValue, count])
  }

  /** Add hits to this side's hit pool */
  addHits(source: HitSource, hits: number): CombatSideState {
    if (hits === 0) return this

    const validTargets = getValidTargets(source)
    const newPool: HitPool = { source, hits, validTargets }

    return new CombatSideState(this.stats, this._units, [
      ...this._hitPools,
      newPool,
    ])
  }

  /** Assign hits from pools, filtered by participating units */
  assignHits(
    participatingUnits: ReadonlySet<UnitType>,
    unitPriority?: UnitType[],
  ): CombatSideState {
    const poolsToProcess = this._hitPools

    if (poolsToProcess.length === 0) {
      return this
    }

    // Only consider participating units for hit assignment
    const baseOrder = unitPriority ?? DEFAULT_UNIT_SACRIFICE_ORDER
    const sacrificeOrder = baseOrder.filter(type =>
      participatingUnits.has(type),
    )
    let currentUnits = { ...this._units }

    for (const pool of poolsToProcess) {
      const result = this.destroyUnitsFromPool(
        currentUnits,
        pool.hits,
        pool.validTargets,
        sacrificeOrder,
        participatingUnits,
      )
      currentUnits = result.units
    }

    // Clean up empty unit arrays
    const cleanedUnits: Partial<Record<UnitType, Unit[]>> = {}
    for (const [type, unitList] of Object.entries(currentUnits)) {
      if (unitList && unitList.length > 0) {
        cleanedUnits[type as UnitType] = unitList
      }
    }

    return new CombatSideState(this.stats, cleanedUnits, [])
  }

  private destroyUnitsFromPool(
    units: Partial<Record<UnitType, Unit[]>>,
    hits: number,
    validTargets: UnitType[],
    sacrificeOrder: UnitType[],
    participatingUnits: ReadonlySet<UnitType>,
  ): { units: Partial<Record<UnitType, Unit[]>>; remainingHits: number } {
    if (hits <= 0) return { units, remainingHits: 0 }

    const targetSet = validTargets.length > 0 ? new Set(validTargets) : null

    // Build list of destroyable units in sacrifice order (only participating units)
    const destroyable: Array<{ type: UnitType }> = []

    for (const type of sacrificeOrder) {
      if (targetSet && !targetSet.has(type)) continue
      if (!participatingUnits.has(type)) continue
      const typeUnits = units[type]
      if (!typeUnits) continue

      for (let i = 0; i < typeUnits.length; i++) {
        destroyable.push({ type })
      }
    }

    // Count units to destroy per type
    const toDestroy = destroyable.slice(0, hits)
    const destroyCount = new Map<UnitType, number>()

    for (const { type } of toDestroy) {
      destroyCount.set(type, (destroyCount.get(type) ?? 0) + 1)
    }

    // Build new units object, removing destroyed units
    const newUnits: Partial<Record<UnitType, Unit[]>> = {}

    for (const [type, typeUnits] of Object.entries(units)) {
      const unitType = type as UnitType
      const removeCount = destroyCount.get(unitType) ?? 0
      const remaining = typeUnits!.slice(removeCount)

      if (remaining.length > 0) {
        newUnits[unitType] = remaining
      }
    }

    return {
      units: newUnits,
      remainingHits: Math.max(0, hits - toDestroy.length),
    }
  }

  /** Create a deep clone of this state */
  clone(): CombatSideState {
    return new CombatSideState(
      this.stats,
      structuredClone(this._units),
      structuredClone(this._hitPools),
    )
  }

  /** Count total units, optionally filtered by participating units */
  countUnits(participatingUnits?: ReadonlySet<UnitType>): number {
    let total = 0
    for (const [type, units] of Object.entries(this._units)) {
      if (!units) continue
      if (participatingUnits && !participatingUnits.has(type as UnitType))
        continue
      total += units.length
    }
    return total
  }
}
