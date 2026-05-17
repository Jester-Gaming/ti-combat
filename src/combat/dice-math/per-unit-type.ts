import type { CombatSide, UnitType } from '@/types'

import type { MetaPhase } from '../combat-state/types'
import { parseVariantId } from '../utils/unit-variant'
import type { DiceMathBranch, PendingEffect } from './branch-accumulator'
import {
  makeEmptyPendingHitPool,
  type PendingHitPool,
} from './branch-accumulator'
import { applyRerollSpecs } from './phases/apply-rerolls'
import { collapseBranches } from './phases/collapse-branches'
import type { PreSplit, SideBuckets } from './pre-split'
import { sortValidTargetsByPriority } from './sort-valid-targets'
import type {
  CollectedDice,
  ConditionalModifier,
  ConditionalModifierTargetSpec,
  CustomRollModifier,
  CustomRollTargetSpec,
  FlatSource,
  Modifier,
  RerollModifier,
  RerollTargetSpec,
  RollTriggerModifier,
  RollTriggerTargetSpec,
  Source,
} from './types'
import { buildSourceMap, flattenSources } from './types'
import { binomial, hitProb } from './utils/get-dice-distribution'

interface PerUnitTypeInput {
  dice: CollectedDice
  preSplit: PreSplit
  modifiers: Modifier[]
  validTargets: { attacker: UnitType[]; defender: UnitType[] }
  priorityList: {
    attacker: UnitType[] | undefined
    defender: UnitType[] | undefined
  }
  meta: MetaPhase
}

/**
 * Per-unit-type mode (dice-math spec §5): per-side, build the joint
 * binomial distribution over `hits: Record<Source, number>` (Source =
 * `${variant}#${entryIdx}`), traverse REROLL modifiers (step 5a),
 * ROLL_TRIGGER (step 5b — runs before CONDITIONAL_MODIFIER per the
 * in-function comment), then CONDITIONAL_MODIFIER (step 5c). Branches
 * with identical (hits, usesDelta, pendingEffects) collapse between
 * modifiers.
 *
 * Final assembly (step 7): for each combined attacker×defender side
 * outcome, sum per-source hits within each Step-4 bucket. Rest buckets
 * feed the primary HitPool with the side's default validTargets; siphon
 * buckets feed their spec's `transform(count)` and the result is
 * appended to the landing side's pools.
 */
export function runPerUnitTypeMode(input: PerUnitTypeInput): DiceMathBranch[] {
  const sides = (['attacker', 'defender'] as const).map(side => {
    const sources = flattenSources(input.dice[side])
    const sourceMap = buildSourceMap(input.dice[side])
    const sideCustomRolls = pickCustomRolls(input.modifiers, side)
    let branches = initialBranches(sources, sideCustomRolls)
    const sideRerolls = pickRerolls(input.modifiers, side)
    if (sideRerolls.length > 0) {
      branches = applyRerollSpecs(
        branches,
        sourceMap,
        sideRerolls,
        (base, hits, probability) => ({
          probability,
          hits,
          usesDelta: base.usesDelta,
          pendingEffects: base.pendingEffects,
        }),
      )
      branches = collapseSideBranches(branches)
    }
    // ROLL_TRIGGER runs BEFORE CONDITIONAL_MODIFIER even though the spec
    // lists the conditional pass as step 4 and the trigger pass as step 5.
    // The trigger fires on the natural face (the die's roll, not its post-
    // flip identity). Once CONDITIONAL_MODIFIER has converted a face-6 miss
    // into a hit, that die joins the hit bucket and the trigger pass — which
    // assumes uniform face distribution within hits — would spuriously
    // promote it into the natural-9/10 pool. Running the trigger first uses
    // the post-reroll, pre-flip face distribution, which IS face-uniform
    // within each bucket, so trigger enumeration is exact and Heart-flipped
    // dice can never become naturals.
    const sideNaturals = pickRollTriggers(input.modifiers, side)
    for (const spec of sideNaturals) {
      branches = applyRollTrigger(branches, sourceMap, spec, side)
      branches = collapseSideBranches(branches)
    }
    const sideConditionals = pickConditionals(input.modifiers, side)
    branches = applyConditionalSpecs(branches, sourceMap, sideConditionals)
    branches = collapseSideBranches(branches)
    return { side, branches }
  })

  const out: DiceMathBranch[] = []
  for (const a of sides[0].branches) {
    for (const d of sides[1].branches) {
      const prob = a.probability * d.probability
      if (prob === 0) continue
      const pools: Record<CombatSide, PendingHitPool> = {
        attacker: makeEmptyPendingHitPool(),
        defender: makeEmptyPendingHitPool(),
      }
      emitPools(
        a.hits,
        input.preSplit.attacker,
        input.validTargets[input.preSplit.attacker.landingSide],
        input.priorityList[input.preSplit.attacker.landingSide],
        input.meta,
        pools,
      )
      emitPools(
        d.hits,
        input.preSplit.defender,
        input.validTargets[input.preSplit.defender.landingSide],
        input.priorityList[input.preSplit.defender.landingSide],
        input.meta,
        pools,
      )
      out.push({
        probability: prob,
        pendingHitPool: pools,
        usesDelta: mergeUses(a.usesDelta, d.usesDelta),
        destroyedUnits: new Set(),
        pendingEffects: [...a.pendingEffects, ...d.pendingEffects],
      })
    }
  }
  return collapseBranches(out)
}

function mergeUses(
  a: Map<string, number>,
  b: Map<string, number>,
): Map<string, number> {
  if (a.size === 0 && b.size === 0) return new Map()
  const out = new Map(a)
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v)
  return out
}

// ============================================================================
// Side-level branch state
// ============================================================================

interface SideBranch {
  probability: number
  /** Per-source hit count. Sources missing from the record produced no dice. */
  hits: Record<Source, number>
  /** AbilityKey → use count consumed in this branch (for this side). */
  usesDelta: Map<string, number>
  /** Side-effect entries forwarded to the engine's branch dispatcher.
   *  Populated by ROLL_TRIGGER specs that carry an `effect` callback. */
  pendingEffects: PendingEffect[]
}

function initialBranches(
  sources: FlatSource[],
  customRolls: CustomRollTargetSpec[],
): SideBranch[] {
  let branches: SideBranch[] = [
    { probability: 1, hits: {}, usesDelta: new Map(), pendingEffects: [] },
  ]
  for (const s of sources) {
    const totalDice = s.unitCount * s.dicePerUnit
    if (totalDice <= 0) continue
    const pmf = entryPmf(s, customRolls)
    const next: SideBranch[] = []
    for (const b of branches) {
      for (let k = 0; k < pmf.length; k++) {
        const p = pmf[k]
        if (p === 0) continue
        next.push({
          probability: b.probability * p,
          hits: { ...b.hits, [s.source]: k },
          usesDelta: b.usesDelta,
          pendingEffects: b.pendingEffects,
        })
      }
    }
    branches = next
  }
  return branches
}

/** Resolve the entry's hit PMF. If a CUSTOM_ROLL spec matches (deterministic
 *  scan in declaration order — first match wins), produce the per-unit PMF
 *  via its generator and convolve `unitCount` copies. Otherwise fall back to
 *  the natural binomial over the entry's total dice. */
function entryPmf(
  s: FlatSource,
  customRolls: CustomRollTargetSpec[],
): number[] {
  const totalDice = s.unitCount * s.dicePerUnit
  for (const spec of customRolls) {
    if (!spec.shouldTransform(s.hitValue, s.dicePerUnit)) continue
    const perUnit = spec.createGenerator(s.hitValue, s.dicePerUnit)
    return convolveN(perUnit, s.unitCount)
  }
  return binomial(totalDice, hitProb(s.hitValue))
}

function pickCustomRolls(
  modifiers: Modifier[],
  side: CombatSide,
): CustomRollTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: CustomRollTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'CUSTOM_ROLL') continue
    const spec = (m as CustomRollModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

/** Convolve `pmf` with itself `n` times (polynomial multiplication over PMFs).
 *  `n === 0` collapses to the unit mass at 0; `n === 1` returns `pmf`. */
function convolveN(pmf: number[], n: number): number[] {
  if (n <= 0) return [1]
  if (n === 1) return [...pmf]
  let result = pmf
  for (let i = 1; i < n; i++) result = convolvePmf(result, pmf)
  return result
}

function convolvePmf(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    if (ai === 0) continue
    for (let j = 0; j < b.length; j++) {
      const bj = b[j]
      if (bj === 0) continue
      out[i + j] += ai * bj
    }
  }
  return out
}

function pickRerolls(
  modifiers: Modifier[],
  side: CombatSide,
): RerollTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: RerollTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'REROLL') continue
    const spec = (m as RerollModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

function pickConditionals(
  modifiers: Modifier[],
  side: CombatSide,
): ConditionalModifierTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: ConditionalModifierTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'CONDITIONAL_MODIFIER') continue
    const spec = (m as ConditionalModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

/**
 * CONDITIONAL_MODIFIER (dice-math spec §4). Same-sign specs stack: each
 * modifier contributes one application per die, so two `+1` modifiers
 * can combine to `+2` on a single die. A die converted by one modifier
 * is never re-targeted by another (positive flips happen on natural
 * misses, negative flips happen on natural hits — disjoint pools by
 * construction).
 *
 * For each branch and same-sign spec batch:
 *   1. Per matched source, enumerate the multinomial distribution of
 *      misses (positive batch) or hits (negative batch) over deficit
 *      tiers 1..D plus the "high" bucket (deficit > D non-flippable).
 *      Here D = sum of `|bonus|` across the batch — the max combined
 *      shift a single die can receive.
 *   2. Cross-product the per-source enumerations.
 *   3. Greedy global allocation: flip tier-1 dice first (1 use each),
 *      then tier-2 (2 uses each), etc., capped at total budget
 *      (= sum of `limit` across the batch).
 *   4. Distribute consumed uses across specs in declaration order,
 *      respecting per-spec limits.
 */
function applyConditionalSpecs(
  branches: SideBranch[],
  sourceMap: Record<Source, FlatSource>,
  specs: ConditionalModifierTargetSpec[],
): SideBranch[] {
  if (specs.length === 0) return branches
  const positives = specs.filter(s => s.bonus > 0)
  const negatives = specs.filter(s => s.bonus < 0)
  let result = branches
  if (positives.length > 0)
    result = applyConditionalBatch(result, sourceMap, positives)
  if (negatives.length > 0)
    result = applyConditionalBatch(result, sourceMap, negatives)
  return result
}

function applyConditionalBatch(
  branches: SideBranch[],
  sourceMap: Record<Source, FlatSource>,
  rawSpecs: ConditionalModifierTargetSpec[],
): SideBranch[] {
  // Sort by ability key so use attribution is deterministic regardless of
  // PREPARE shuffle order: alphabetically-first key consumes its share of
  // the budget before later keys.
  const specs = [...rawSpecs].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  )
  const sign: 1 | -1 = specs[0].bonus > 0 ? 1 : -1
  const D = specs.reduce((s, sp) => s + Math.abs(sp.bonus), 0)
  const totalBudget = specs.reduce((s, sp) => s + sp.limit, 0)
  if (D <= 0 || totalBudget <= 0) return branches

  const next: SideBranch[] = []
  for (const branch of branches) {
    // Same source filter assumed across the batch — pick from first.
    const matched = matchedSources(branch.hits, sourceMap, specs[0].source)
    if (matched.length === 0) {
      next.push(branch)
      continue
    }

    // Per-source tier enumerations.
    const perSource = matched.map(source => {
      const info = sourceMap[source]
      const k = branch.hits[source] ?? 0
      const totalDice = info.unitCount * info.dicePerUnit
      const available = sign > 0 ? totalDice - k : k
      const tierFaces = sign > 0 ? info.hitValue - 1 : 11 - info.hitValue
      return enumerateTierMultinomial(available, D, tierFaces)
    })

    // Cross-product.
    let outcomes: { probability: number; perSourceCounts: number[][] }[] = [
      { probability: 1, perSourceCounts: [] },
    ]
    for (const list of perSource) {
      const nextOutcomes: typeof outcomes = []
      for (const o of outcomes) {
        for (const item of list) {
          nextOutcomes.push({
            probability: o.probability * item.probability,
            perSourceCounts: [...o.perSourceCounts, item.counts],
          })
        }
      }
      outcomes = nextOutcomes
    }

    for (const outcome of outcomes) {
      // Aggregate tier-T counts across sources (T=1..D; high bucket ignored).
      const tierTotals = new Array<number>(D + 1).fill(0)
      for (const counts of outcome.perSourceCounts) {
        for (let t = 0; t < D; t++) tierTotals[t + 1] += counts[t]
      }

      // Greedy: flip tier-1 first, then tier-2, ..., constrained by budget.
      let budget = totalBudget
      const flipsByTier = new Array<number>(D + 1).fill(0)
      for (let T = 1; T <= D; T++) {
        if (budget < T) break
        const canFlip = Math.min(tierTotals[T], Math.floor(budget / T))
        flipsByTier[T] = canFlip
        budget -= T * canFlip
      }

      // Per-source flips, distributed in declaration order within each tier.
      const newHits = { ...branch.hits }
      const remainingPerTier = flipsByTier.slice()
      for (let s = 0; s < matched.length; s++) {
        const source = matched[s]
        const counts = outcome.perSourceCounts[s]
        let sourceFlips = 0
        for (let T = 1; T <= D; T++) {
          const take = Math.min(counts[T - 1], remainingPerTier[T])
          sourceFlips += take
          remainingPerTier[T] -= take
        }
        if (sourceFlips > 0) {
          newHits[source] = (newHits[source] ?? 0) + sign * sourceFlips
        }
      }

      // Consumed uses = sum of T * flips_T. Distribute to specs in order,
      // respecting per-spec limits.
      let totalConsumed = 0
      for (let T = 1; T <= D; T++) totalConsumed += T * flipsByTier[T]
      let newUsesDelta = branch.usesDelta
      if (totalConsumed > 0) {
        newUsesDelta = new Map(branch.usesDelta)
        let remaining = totalConsumed
        for (const spec of specs) {
          if (remaining <= 0) break
          const take = Math.min(spec.limit, remaining)
          if (take === 0) continue
          newUsesDelta.set(spec.key, (newUsesDelta.get(spec.key) ?? 0) + take)
          remaining -= take
        }
      }

      next.push({
        probability: branch.probability * outcome.probability,
        hits: newHits,
        usesDelta: newUsesDelta,
        pendingEffects: branch.pendingEffects,
      })
    }
  }
  return next
}

/** Enumerate the multinomial joint (m_1, m_2, ..., m_D, m_high) with
 *  Σ = N, where each tier 1..D corresponds to one specific face value
 *  (probability `1/tierFaces` per die) and m_high collects all faces
 *  with deficit/margin > D. Returns 0 outcomes for empty pools. */
function enumerateTierMultinomial(
  N: number,
  D: number,
  tierFaces: number,
): { counts: number[]; probability: number }[] {
  if (N <= 0 || tierFaces <= 0) {
    return [{ counts: new Array<number>(D + 1).fill(0), probability: 1 }]
  }
  const pT = 1 / tierFaces
  const pHigh = Math.max(0, (tierFaces - D) / tierFaces)
  const out: { counts: number[]; probability: number }[] = []

  const recurse = (level: number, remaining: number, counts: number[]) => {
    if (level === D) {
      const mHigh = remaining
      const full = [...counts, mHigh]
      out.push({
        counts: full,
        probability: multinomialPmf(N, full, pT, pHigh),
      })
      return
    }
    for (let m = 0; m <= remaining; m++) {
      counts.push(m)
      recurse(level + 1, remaining - m, counts)
      counts.pop()
    }
  }
  recurse(0, N, [])
  return out
}

function multinomialPmf(
  N: number,
  counts: number[],
  pT: number,
  pHigh: number,
): number {
  // counts has D+1 entries; first D share pT, last is m_high with pHigh.
  let coeff = factorial(N)
  for (const c of counts) coeff /= factorial(c)
  const D = counts.length - 1
  let p = 1
  for (let i = 0; i < D; i++) {
    if (counts[i] === 0) continue
    if (pT === 0) return 0
    p *= Math.pow(pT, counts[i])
  }
  const mHigh = counts[D]
  if (mHigh > 0) {
    if (pHigh === 0) return 0
    p *= Math.pow(pHigh, mHigh)
  }
  return coeff * p
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function matchedSources(
  hits: Record<Source, number>,
  sourceMap: Record<Source, FlatSource>,
  variantFilter: UnitType | undefined,
): Source[] {
  const sources = Object.keys(hits)
  if (variantFilter === undefined) return sources
  return sources.filter(s => sourceMap[s]?.variant === variantFilter)
}

function matchedSourcesByUnits(
  hits: Record<Source, number>,
  sourceMap: Record<Source, FlatSource>,
  units: UnitType[] | undefined,
): Source[] {
  const sources = Object.keys(hits)
  if (!units || units.length === 0) return sources
  // `sourceMap[s].variant` is the dice-pool outer key (currently base type
  // — see `CombatSideState.collectDice`). A ROLL_TRIGGER filter may be
  // stated as a variant key (e.g. 'FLAGSHIP:Galvanized') or a base type
  // ('FLAGSHIP'); expand each entry to its base type so both forms match.
  const allowedBaseTypes = new Set<UnitType>(
    units.map(u => parseVariantId(u).type as UnitType),
  )
  return sources.filter(s => {
    const key = sourceMap[s]?.variant
    if (key === undefined) return false
    if (units.includes(key)) return true
    if (allowedBaseTypes.has(key)) return true
    const baseType = parseVariantId(key).type as UnitType
    return units.includes(baseType) || allowedBaseTypes.has(baseType)
  })
}

function pickRollTriggers(
  modifiers: Modifier[],
  side: CombatSide,
): RollTriggerTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: RollTriggerTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'ROLL_TRIGGER') continue
    const spec = (m as RollTriggerModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

/**
 * ROLL_TRIGGER (dice-math spec §5). For each source matched by the
 * spec's `units` filter (or every source when undefined), enumerate the
 * joint distribution of trigger counts conditioned on the branch's
 * current (hits, misses) split. The total trigger count rides on a
 * per-branch pending effect; the engine's branch-construction step
 * (see `_branchesFromMathKernel`) dispatches each effect against the
 * freshly-forked branch state so anything the effect does (extra hits,
 * destroyed units, etc.) is already reflected when `advance()` returns.
 *
 * Conditional-face probabilities:
 *   p(trigger | hit)  = | faces ∩ {h..10}  | / (11 - h)
 *   p(trigger | miss) = | faces ∩ {1..h-1} | /  (h - 1)
 *
 * Relies on uniform face distribution within each die's hit / miss
 * bucket — true after step 3 (REROLL) because both `target='ALL'` and
 * `target='MISSES'` leave the surviving hit/miss faces uniform. Running
 * BEFORE step 4 keeps that invariant; once CONDITIONAL_MODIFIER mixes a
 * face-6 flip into the hit bucket the assumption would break.
 */
function applyRollTrigger(
  branches: SideBranch[],
  sourceMap: Record<Source, FlatSource>,
  spec: RollTriggerTargetSpec,
  side: CombatSide,
): SideBranch[] {
  const next: SideBranch[] = []
  for (const branch of branches) {
    const matched = matchedSourcesByUnits(branch.hits, sourceMap, spec.units)
    if (matched.length === 0) {
      next.push(branch)
      continue
    }

    // Per-source joint distribution of trigger counts.
    const perSource = matched.map(source => {
      const info = sourceMap[source]
      const k = branch.hits[source] ?? 0
      const n = info.unitCount * info.dicePerUnit
      const h = info.hitValue
      const hitTrigFaces = spec.faces.filter(f => f >= h && f <= 10).length
      const missTrigFaces = spec.faces.filter(f => f >= 1 && f < h).length
      const pHit = 11 - h > 0 ? hitTrigFaces / (11 - h) : 0
      const pMiss = h - 1 > 0 ? missTrigFaces / (h - 1) : 0
      const pmfHit = binomial(k, pHit)
      const pmfMiss = binomial(n - k, pMiss)
      const dist: { count: number; probability: number }[] = []
      for (let th = 0; th < pmfHit.length; th++) {
        for (let tm = 0; tm < pmfMiss.length; tm++) {
          const p = pmfHit[th] * pmfMiss[tm]
          if (p === 0) continue
          dist.push({ count: th + tm, probability: p })
        }
      }
      return { source, dist }
    })

    // Cross-product across matched sources.
    let combos: { perSource: number[]; probability: number }[] = [
      { perSource: [], probability: 1 },
    ]
    for (const ps of perSource) {
      const nextCombos: typeof combos = []
      for (const c of combos) {
        for (const item of ps.dist) {
          nextCombos.push({
            perSource: [...c.perSource, item.count],
            probability: c.probability * item.probability,
          })
        }
      }
      combos = nextCombos
    }

    for (const combo of combos) {
      let totalT = 0
      for (const t of combo.perSource) totalT += t
      const newEffects =
        totalT > 0
          ? [
              ...branch.pendingEffects,
              {
                kind: 'rollTrigger' as const,
                abilityKey: spec.key,
                slotId: spec.slotId,
                side,
                payload: { count: totalT },
              },
            ]
          : branch.pendingEffects
      next.push({
        probability: branch.probability * combo.probability,
        hits: branch.hits,
        usesDelta: branch.usesDelta,
        pendingEffects: newEffects,
      })
    }
  }
  return next
}

function collapseSideBranches(branches: SideBranch[]): SideBranch[] {
  const map = new Map<string, SideBranch>()
  for (const b of branches) {
    const key = `${serializeHits(b.hits)}|${serializeUses(b.usesDelta)}|${serializeSideEffects(b.pendingEffects)}`
    const existing = map.get(key)
    if (existing) {
      existing.probability += b.probability
    } else {
      map.set(key, {
        probability: b.probability,
        hits: b.hits,
        usesDelta: b.usesDelta,
        pendingEffects: b.pendingEffects,
      })
    }
  }
  return Array.from(map.values())
}

function serializeSideEffects(effects: PendingEffect[]): string {
  if (effects.length === 0) return ''
  return effects
    .map(e => {
      if (e.kind === 'rollTrigger') {
        const payload = e.payload as { count: number }
        return `n:${e.abilityKey}:${e.slotId}:${e.side}:${payload.count}`
      }
      return `${e.kind}:${e.abilityKey}:${e.slotId}:${e.side}`
    })
    .join('@')
}

function serializeHits(hits: Record<Source, number>): string {
  const keys = Object.keys(hits).sort()
  return keys.map(k => `${k}=${hits[k]}`).join(',')
}

function serializeUses(uses: Map<string, number>): string {
  if (uses.size === 0) return ''
  return Array.from(uses.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
}

// ============================================================================
// Hit-pool assembly (step 6)
// ============================================================================

function emitPools(
  hits: Record<Source, number>,
  side: SideBuckets,
  validTargets: UnitType[],
  priorityList: UnitType[] | undefined,
  meta: MetaPhase,
  pools: Record<CombatSide, PendingHitPool>,
): void {
  const landingSide = side.landingSide
  const pool = pools[landingSide]
  for (const bucket of side.buckets) {
    let count = 0
    for (const source of bucket.sources) {
      count += hits[source] ?? 0
    }
    if (count <= 0) continue
    if (bucket.spec) {
      const entry = bucket.spec.transform(count)
      pool.custom.push({
        key: bucket.spec.key,
        base: entry.base,
        unitPriority: entry.unitPriority,
      })
    } else if (validTargets.length > 0) {
      pool.custom.push({
        key: meta,
        base: count,
        unitPriority: sortValidTargetsByPriority(validTargets, priorityList),
      })
    } else {
      pool.base += count
    }
  }
}
