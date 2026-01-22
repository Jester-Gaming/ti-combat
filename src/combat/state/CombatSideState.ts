import type { DieValue, UnitStats, UnitType } from '@/types'
import type { Unit } from '../types'
import type { HitPool, HitSource } from './HitPool'
import { getValidTargets } from './HitPool'

const UNIT_SACRIFICE_ORDER: UnitType[] = [
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
  private readonly _participatingUnits: Set<UnitType>

  constructor(
    stats: Partial<Record<UnitType, UnitStats>>,
    units: Partial<Record<UnitType, Unit[]>>,
    hitPools: HitPool[] = [],
    participatingUnits?: Set<UnitType>,
  ) {
    this.stats = stats
    this._units = units
    this._hitPools = hitPools
    this._participatingUnits =
      participatingUnits ?? this.computeParticipatingUnits(units)
  }

  private computeParticipatingUnits(
    units: Partial<Record<UnitType, Unit[]>>,
  ): Set<UnitType> {
    const participating = new Set<UnitType>()
    for (const [type, unitList] of Object.entries(units)) {
      if (unitList && unitList.length > 0) {
        participating.add(type as UnitType)
      }
    }
    return participating
  }

  get units(): Partial<Record<UnitType, Unit[]>> {
    return this._units
  }

  get hitPools(): readonly HitPool[] {
    return this._hitPools
  }

  get participatingUnits(): ReadonlySet<UnitType> {
    return this._participatingUnits
  }

  /** Sum of all pending hits across all pools */
  get pendingHits(): number {
    return this._hitPools.reduce((sum, pool) => sum + pool.hits, 0)
  }

  /** Collect dice for a specific combat phase */
  collectDice(source: HitSource): DieValue[] {
    const getDieValue = (stats: UnitStats): DieValue | null | undefined => {
      switch (source) {
        case 'COMBAT':
          return stats.COMBAT
        case 'AFB':
          return stats.ABILITIES?.AFB
        case 'BOMBARDMENT':
          return stats.ABILITIES?.BOMBARDMENT
        case 'SPACE_CANNON':
          return stats.ABILITIES?.SPACE_CANNON
      }
    }

    const diceByHitValue = new Map<number, number>()

    for (const [type, units] of Object.entries(this._units)) {
      if (!units || units.length === 0) continue
      if (!this._participatingUnits.has(type as UnitType)) continue

      const stats = this.stats[type as keyof typeof this.stats]
      const dieValue = stats && getDieValue(stats)
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

    return new CombatSideState(
      this.stats,
      this._units,
      [...this._hitPools, newPool],
      this._participatingUnits,
    )
  }

  /** Assign hits from pools, optionally filtering by source */
  assignHits(poolFilter?: HitSource): CombatSideState {
    const poolsToProcess = poolFilter
      ? this._hitPools.filter(p => p.source === poolFilter)
      : this._hitPools

    const remainingPools = poolFilter
      ? this._hitPools.filter(p => p.source !== poolFilter)
      : []

    if (poolsToProcess.length === 0) {
      return this
    }

    let currentUnits = { ...this._units }
    let totalRemainingHits = 0

    for (const pool of poolsToProcess) {
      const result = this.destroyUnitsFromPool(
        currentUnits,
        pool.hits,
        pool.validTargets,
      )
      currentUnits = result.units
      totalRemainingHits += result.remainingHits
    }

    // Clean up empty unit arrays
    const cleanedUnits: Partial<Record<UnitType, Unit[]>> = {}
    for (const [type, unitList] of Object.entries(currentUnits)) {
      if (unitList && unitList.length > 0) {
        cleanedUnits[type as UnitType] = unitList
      }
    }

    // Add back remaining hits as a generic pool if any remain
    const finalPools =
      totalRemainingHits > 0
        ? [
            ...remainingPools,
            {
              source: 'COMBAT' as HitSource,
              hits: totalRemainingHits,
              validTargets: [],
            },
          ]
        : remainingPools

    return new CombatSideState(
      this.stats,
      cleanedUnits,
      finalPools,
      this._participatingUnits,
    )
  }

  private destroyUnitsFromPool(
    units: Partial<Record<UnitType, Unit[]>>,
    hits: number,
    validTargets: UnitType[],
  ): { units: Partial<Record<UnitType, Unit[]>>; remainingHits: number } {
    if (hits === 0) return { units, remainingHits: 0 }

    const targetSet = validTargets.length > 0 ? new Set(validTargets) : null

    // Build list of destroyable units in sacrifice order
    const destroyable: Array<{ type: UnitType; index: number }> = []

    for (const type of UNIT_SACRIFICE_ORDER) {
      if (targetSet && !targetSet.has(type)) continue
      const typeUnits = units[type]
      if (!typeUnits) continue

      for (let i = 0; i < typeUnits.length; i++) {
        destroyable.push({ type, index: i })
      }
    }

    // Determine which units to destroy
    const toDestroy = destroyable.slice(0, hits)
    const destroyCount = new Map<UnitType, number>()

    for (const { type } of toDestroy) {
      destroyCount.set(type, (destroyCount.get(type) ?? 0) + 1)
    }

    // Build new units object
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
      new Set(this._participatingUnits),
    )
  }

  /** Count total units */
  countUnits(): number {
    let total = 0
    for (const units of Object.values(this._units)) {
      if (units) total += units.length
    }
    return total
  }
}
