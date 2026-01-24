import type {
  DieValue,
  FactionKey,
  UnitAbilities,
  UnitDieValue,
  UnitType,
} from '@/types'

/** Unit stats - defines the unit's capabilities */
interface UnitStats {
  COMBAT?: UnitDieValue | null
  ABILITIES?: UnitAbilities
}

/** Unit instance state - runtime state of a single unit */
interface UnitState {
  isDamaged?: boolean
}

/** A single unit combining stats and runtime state */
export type Unit = UnitStats & UnitState

/** A pool of unassigned hits with valid targets */
interface HitPool {
  hits: number
  validTargets: UnitType[]
}

const DEFAULT_UNIT_SACRIFICE_ORDER: UnitType[] = [
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

/** Immutable combat side state */
export class CombatSideState {
  readonly faction: FactionKey
  private readonly _units: Partial<Record<UnitType, Unit[]>>
  private readonly _hitPools: HitPool[]

  constructor(
    faction: FactionKey,
    units: Partial<Record<UnitType, Unit[]>>,
    hitPools: HitPool[] = [],
  ) {
    this.faction = faction
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

  /** Find a unit matching the predicate */
  getUnit(unitType: UnitType, predicate: Partial<UnitState>): Unit | undefined {
    const units = this._units[unitType]
    if (!units) return undefined

    return units.find(unit => {
      for (const [key, value] of Object.entries(predicate)) {
        if (unit[key as keyof UnitState] !== value) return false
      }
      return true
    })
  }

  /** Destroy a specific unit, returns new state */
  destroyUnit(unitType: UnitType, unit: Unit): CombatSideState {
    const units = this._units[unitType]
    if (!units) return this

    const index = units.indexOf(unit)
    if (index === -1) return this

    const newUnits = { ...this._units }
    const remaining = [...units.slice(0, index), ...units.slice(index + 1)]

    if (remaining.length > 0) {
      newUnits[unitType] = remaining
    } else {
      delete newUnits[unitType]
    }

    return new CombatSideState(this.faction, newUnits, this._hitPools)
  }

  /** Collect dice for a specific combat phase, filtered by participating units */
  collectDice(
    source: 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON',
    participatingUnits: ReadonlySet<UnitType>,
  ): DieValue[] {
    const result: DieValue[] = []

    for (const [type, units] of Object.entries(this._units)) {
      if (!units || units.length === 0) continue
      if (!participatingUnits.has(type as UnitType)) continue

      // Get stats from first unit of this type
      const firstUnit = units[0]
      if (!firstUnit) continue

      const dieValue =
        source === 'COMBAT' ? firstUnit.COMBAT : firstUnit.ABILITIES?.[source]
      if (!dieValue) continue

      const [hitValue, dicePerUnit] = dieValue
      if (dicePerUnit <= 0) continue

      const totalDice = units.length * dicePerUnit
      result.push([hitValue, totalDice, type as UnitType])
    }

    return result
  }

  /** Add hits to this side's hit pool */
  addHits(hits: number, validTargets: UnitType[]): CombatSideState {
    if (hits === 0) return this

    const newPool: HitPool = { hits, validTargets }

    return new CombatSideState(this.faction, this._units, [
      ...this._hitPools,
      newPool,
    ])
  }

  /** Assign hits from pools, filtered by participating units */
  assignHits(
    participatingUnits: ReadonlySet<UnitType>,
    unitPriority?: UnitType[],
  ): CombatSideState {
    if (this._hitPools.length === 0) {
      return this
    }

    // Only consider participating units for hit assignment
    const baseOrder = unitPriority ?? DEFAULT_UNIT_SACRIFICE_ORDER
    const sacrificeOrder = baseOrder.filter(type =>
      participatingUnits.has(type),
    )
    let currentUnits = { ...this._units }

    for (const pool of this._hitPools) {
      currentUnits = this.destroyUnitsFromPool(
        currentUnits,
        pool.hits,
        pool.validTargets,
        sacrificeOrder,
        participatingUnits,
      )
    }

    // Clean up empty unit arrays
    const cleanedUnits: Partial<Record<UnitType, Unit[]>> = {}
    for (const [type, unitList] of Object.entries(currentUnits)) {
      if (unitList && unitList.length > 0) {
        cleanedUnits[type as UnitType] = unitList
      }
    }

    return new CombatSideState(this.faction, cleanedUnits, [])
  }

  private destroyUnitsFromPool(
    units: Partial<Record<UnitType, Unit[]>>,
    hits: number,
    validTargets: UnitType[],
    sacrificeOrder: UnitType[],
    participatingUnits: ReadonlySet<UnitType>,
  ): Partial<Record<UnitType, Unit[]>> {
    if (hits <= 0) return units

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

    return newUnits
  }

  /** Create a deep clone of this state */
  clone(): CombatSideState {
    return new CombatSideState(
      this.faction,
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
