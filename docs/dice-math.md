# Dice-Math Kernel

The dice-math kernel turns a populated `SideDiceCollection` (per-variant dice
entries with unit count, hit value, dice-per-unit) plus a set of
ability-declared modifiers into a `DiceMathBranch[]` — a finite probability
distribution over post-roll outcomes. Each branch carries `probability`,
`pendingHitPool` (per side), ability `usesDelta`, `destroyedUnits`, and
`pendingEffects`. The kernel is invoked once per dice-roll group and replaces
random sampling with exact enumeration.

Source layout: `src/combat/dice-math/`. Entry point: `runDiceMath` in
`run-dice-math.ts`.

## Pipeline

```
Step 1  apply dice-shape +     → mutated SideDiceCollection
        hit-value modifiers
        (in place)
Step 2  collect modifiers      → Modifier[]
Step 3  decide mode            → fast | per-unit-type
Step 4  split sources by       → SideBuckets
        ADDITIONAL_HIT_POOL

  Fast mode (only ADDITIONAL_HIT_POOL / unconditional REROLL):
    Step 5  REROLL pass (per source, if any) → collapse to bucket totals
    per bucket: Binomial(total dice, hit prob) over total hits

  Per-unit-type mode (anything else):
    Step 5         initial per-source binomial
    Step 6a        REROLL pass
    Step 6b        ROLL_TRIGGER pass
    Step 6c        CONDITIONAL_MODIFIER pass
    cross-product attacker × defender branches

Step 7  emit hit pools per bucket → DiceMathBranch[]
Step 8  use accounting           → markOneShotUses (one-shot REROLLs) +
                                    markDeclarationUses (deferred decls)
Step 9  AFB fighter-pool clamp   → applyAfbClamp (only when meta === 'AFB')
```

The `Modifier` union has five kinds: `REROLL`, `CONDITIONAL_MODIFIER`,
`ADDITIONAL_HIT_POOL`, `ROLL_TRIGGER`, and `CUSTOM_ROLL` (a caller-supplied
per-unit PMF that replaces the natural binomial). The dice-shape and hit-value
declarations (`SET_DICE_COUNT`, `ADD_DICE_COUNT`, `ADD_DICE_GROUP`,
`HIT_VALUE`) are applied in Step 1 and don't appear in the `Modifier` union.

Effect callbacks declared by `ROLL_TRIGGER` decls (e.g. Strike Wing
Alpha II destroying infantry) are dispatched per branch by
`CombatState._branchesFromMathKernel` (`src/combat/combat-state/combat-state.ts`)
against the freshly-forked branch state, so when `advance()` returns each
branch already reflects the resolved effect.

## Step 1 — Apply dice-shape and hit-value modifiers

The per-side `SideDiceCollection` is **built upstream** by `collectSideDice`
(`CombatSideState.collectDice`) and handed to `runDiceMath` as
`input.diceCollection`. The kernel does not collect dice; it mutates the
collection in place.

```ts
// One list of dice entries per base type. Each entry is
// [unitCount, hitValue, dicePerUnit].
type SideDiceCollection = Partial<
  Record<UnitBaseType, [number, number, number][]>
>

// A source = a single (variant, entry-index) slot.
type Source = string // `${variant}#${entryIdx}`

// `flattenSources(collection)` produces the per-source view the passes iterate:
interface FlatSource {
  source: Source // `${variant}#${entryIdx}`
  variant: UnitBaseType
  entryIdx: number
  unitCount: number
  dicePerUnit: number
  hitValue: number
}
```

- `dicePerUnit = baseDice + bonusDice`.
- Entries collapse only when `(hitValue, dicePerUnit)` match within a base
  type — galvanized destroyer (4 dice) and normal upgraded destroyer (3 dice)
  become two distinct entries, both under variant `DESTROYER`.
- Custom dice from `addDiceGroup` are stored under the ability key (cast to
  `UnitBaseType`) rather than a real base type.

The collection is mutated in place by two sub-steps, implemented in
`dice-math/phases/`:

1. `applyDiceShapeModifiers` — `SET_DICE_COUNT`, `ADD_DICE_COUNT`, and
   `ADD_DICE_GROUP` decls are applied in push order so later mods see
   earlier collection state.
2. `applyStoredHitValueModifiers` — `HIT_VALUE` decls (queued by
   `applyBonusToResult`) shift `hitValues` per side, splitting `singleUnit`
   modifiers out of their bucket when needed.

After Step 1 the collection reflects every BEFORE-timing dice-shape and
hit-value modification; downstream passes see only the resolved dice and
hit values.

## Step 2 — Collect modifiers

`collectModifiers` translates the dice-roll group's decl arrays into the
math-kernel `Modifier` union. Each modifier carries a sided target tuple
`[OWN?, OPPONENT?]` indexed from the firing side's perspective.

| Modifier               | Target spec                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `REROLL`               | `{ key, ownerSide, target: 'MISSES' \| 'HITS' \| 'ALL', rerollIf? }` |
| `CONDITIONAL_MODIFIER` | `{ key, ownerSide, bonus, limit, source? }`                          |
| `ADDITIONAL_HIT_POOL`  | `{ key, units: UnitType[], transform: (count) => HitPool }`          |
| `ROLL_TRIGGER`         | `{ key, slotId, faces: number[], units?: UnitType[] }` (+ effect)    |
| `CUSTOM_ROLL`          | `{ key, shouldTransform(hv, dpu), createGenerator(hv, dpu) }`        |

Decls deduplicate to a single modifier, but the group key depends on the kind:

- `REROLL` and `CONDITIONAL_MODIFIER` dedup by `(ownerSide, abilityKey)`, so
  the same ability key owned by both sides yields two modifiers. They carry
  `ownerSide` so `uses` are billed on the owning side even when the affected
  dice belong to the opponent (e.g. Heart of Ixth, Scramble Frequency).
- `ADDITIONAL_HIT_POOL`, `ROLL_TRIGGER`, and `CUSTOM_ROLL` dedup by `abilityKey`.
- `CONDITIONAL_MODIFIER` reads `limit` from the running ability's `uses`
  snapshot (defaults to 1).
- `ROLL_TRIGGER` unions the `unitType` filters from all decls under
  the same key (e.g. one per firing destroyer). An empty filter means
  "every source on the affected side". The first decl's `slotId` wins
  for effect routing; later decls only extend the filter.

## Step 3 — Mode selection

```
canRunFast = every modifier is ADDITIONAL_HIT_POOL
             or an *unconditional* REROLL (no rerollIf)
```

A REROLL carrying a `rerollIf` predicate forces per-unit-type mode: conditional
rerolls need per-branch fire-tracking to bill `uses` only on branches that
actually rerolled, which only the per-unit-type `SideBranch` (with its
`usesDelta`) supports. `CONDITIONAL_MODIFIER`, `ROLL_TRIGGER`, and
`CUSTOM_ROLL` also disqualify fast mode.

When fast mode qualifies, the kernel skips per-source ROLL_TRIGGER /
CONDITIONAL_MODIFIER enumeration. Without rerolls it emits a binomial
over total hits per bucket; with rerolls it enumerates per-source hits
through the reroll pass and then collapses to bucket totals before the
attacker × defender cross product. Anything else falls back to
per-unit-type mode.

## Step 4 — Bucket split by ADDITIONAL_HIT_POOL

For each firing side, `preSplit` partitions the source map into:

- N spec buckets — one per `ADDITIONAL_HIT_POOL` spec that targets this
  side. A source matches if its variant key (or base type) is listed in
  `spec.units`. First-match wins.
- 1 rest bucket — every unmatched source.

Each downstream pass operates on each bucket independently; spec-bucket
hits feed `spec.transform(count)` to produce a dedicated `HitPool`; rest
bucket hits feed the default unrestricted pool on the landing side.

The landing side is always the firing side's opponent (`preSplit` derives it
directly). Self-damage abilities (e.g. Proxima's second roll) are not handled
by a kernel routing field — the firing side rolls normally and the hits are
redirected post-roll by `_swapHitPools` in `combat-state`.

## Step 5 — Per-unit-type passes

Per side, branches are `{ probability, hits: Record<Source, number>,
usesDelta, pendingEffects }`. Initial branches enumerate the joint
binomial across sources:

```
for each source s with N = unitCount[s] · dicePerUnit[s], p = (11 - h[s]) / 10:
  Binomial(N, p) → k hits in source s
```

Branches collapse on `(hits, usesDelta, pendingEffects)` between passes.
The passes run in this order:

### 5a — REROLL

For each side's REROLL specs in declaration order:

- `rerollIf` (if any) is consulted with the side's pre-reroll marginal
  hit distribution; a `false` result keeps the branch unchanged.
- `target: 'ALL'` rerolls every die in the branch with a fresh uniform
  face — equivalent to resampling the binomial from scratch.
- `target: 'MISSES'` rerolls only the (N − k) miss dice; the k existing
  hits stay. Post-reroll faces inside the hit and miss buckets remain
  uniform within each bucket — this invariant is what step 4b relies on.
- `target: 'HITS'` rerolls only the k hit dice (the inverse of `'MISSES'`).
- Self-routed rolls (Proxima self-bombardment) swap `'MISSES'` ↔ `'HITS'`
  and negate `rerollIf`, so authors always write opponent-facing intent.

Use tracking: one-shot rerolls are billed by `markOneShotUses` (Step 8);
conditional rerolls (`rerollIf`) run in per-unit-type mode so each branch's
`usesDelta` records whether the reroll actually fired.

### 5b — ROLL_TRIGGER (runs before CONDITIONAL_MODIFIER)

For each branch and each trigger spec, per matched source:

```
hitTrigFaces  = |spec.faces ∩ {h..10}|
missTrigFaces = |spec.faces ∩ {1..h-1}|
p(trigger | hit)  = hitTrigFaces  / (11 - h)
p(trigger | miss) = missTrigFaces / (h - 1)
T_source = Binomial(k, p_hit) + Binomial(N-k, p_miss)
```

The joint distribution across matched sources is enumerated by cross
product. Each branch with `totalT > 0` emits a `PendingEffect` carrying
`{ count: totalT }` — the engine dispatches it against the branch state
after the math kernel returns.

**Why before CONDITIONAL_MODIFIER**: the trigger fires on the _rolled_
face, not the post-flip face. After REROLL the surviving faces are
uniform within each bucket, so the conditional binomial above is exact.
Once CONDITIONAL_MODIFIER mixes a flipped face-6 miss into the hit
bucket the uniform assumption breaks (the flipped die's natural face is
6, not a uniform draw from {h..10}). The spec lists this as step 5 by
convention; in code it runs first to preserve the invariant.

### 5c — CONDITIONAL_MODIFIER

Same-sign specs stack — two `+1` modifiers can combine into `+2` on a
single die, but a die converted by one modifier is never re-targeted by
another (positive flips happen on natural misses, negative on natural
hits — disjoint pools by construction).

For each branch and each same-sign batch:

```
D            = Σ |bonus|         over batch              (max per-die shift)
totalBudget  = Σ limit           over batch
sign         = +1 (flip miss→hit) or -1 (flip hit→miss)
tierFaces    = h - 1 (positive batch) or 11 - h (negative batch)
```

Per matched source:

1. Enumerate the multinomial `(m₁, m₂, ..., m_D, m_high)` summing to
   `N - k` (positive) or `k` (negative). Tier T is the face that needs
   exactly +T (or −T) to flip; `m_high` collects faces too far away to
   ever flip.
2. Cross-product across sources to get joint per-source counts.
3. Greedy budget allocation: flip tier-1 dice first (1 use each), then
   tier-2 (2 uses each), capped at `totalBudget`.
4. Distribute consumed uses across specs in alphabetical key order so
   attribution is deterministic regardless of decl order:

```
remaining = totalConsumed
for spec in sortedSpecs:
  take = min(spec.limit, remaining)
  usesDelta[spec.key] += take
  remaining -= take
```

The flipped dice update the branch's `hits[source]` by `±sourceFlips`.

## Step 7 — Emit hit pools

Each branch carries a `pendingHitPool` per side:

```ts
interface PendingHitPool {
  base: number // unrestricted hits landing on this side
  custom: { key: string; base: number; unitPriority: UnitType[] }[]
}
```

For each combined attacker × defender branch:

```
for each bucket on each firing side:
  count = Σ hits[source] for source in bucket
  landing = firingSide's opponent
  if bucket.spec:                                   // ADDITIONAL_HIT_POOL
    pendingHitPool[landing].custom.push(spec.transform(count))  // { base, unitPriority }
  else if validTargets restrict the landing side:   // unit-ability meta restriction
    pendingHitPool[landing].custom.push({ key: meta, base: count, unitPriority })
  else:                                             // unrestricted rest bucket
    pendingHitPool[landing].base += count
```

Restricted `unitPriority` comes from `input.validTargets[landingSide]`, sorted
by the priority list. Unrestricted hits (`base`) take the fast-path during hit
assignment.

Final branches collapse on identity:
`(pendingHitPool, usesDelta, destroyedUnits, pendingEffects)`.

## Effect dispatch

`CombatState._branchesFromMathKernel` clones state per branch, applies
`usesDelta` to `liveAbilities` on the owning sides, merges each side's
`pendingHitPool` into its `hitPool`, removes any `destroyedUnits` (currently
never produced by the kernel — the field is future-proofing), then dispatches
each `PendingEffect`. For `ROLL_TRIGGER` effects, the dispatcher binds a fresh
`AbilityContext` to the branch and invokes `decl.effect(payload.count, branchCtx)`.

Effects typically call:

- `branchCtx.api.opponent.destroyUnits(...)` — direct state mutation.
- `branchCtx.api.{own,opponent}.addHits(count)` — add hits into the same
  commit cycle as the main dice-roll pool. Used for hit-producing triggers
  (e.g. JNS Hylarim's `addHits(count * 2)` for +2 per natural 9/10).

`addHits` is overloaded: `addHits(n)` adds unrestricted hits (drained inline
when the landing side's pool was empty, otherwise merged into the in-flight
group's existing `ASSIGN_HITS` step); `addHits(n, validTargets)` adds
restricted hits and throws if the landing side's pool is non-empty. There is
no separate `addPendingHits` API.
