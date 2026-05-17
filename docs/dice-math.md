# Dice-Math Kernel

The dice-math kernel turns a populated `DicePool` (per-unit dice groups with
hit values, base dice, bonus dice) plus a set of ability-declared modifiers
into a `DiceMathBranch[]` — a finite probability distribution over post-roll
outcomes (`pendingHitPools`, ability `usesDelta`, destroyed units, pending
effects). It is invoked once per dice-roll group (`_rollDice`) and replaces
random sampling with exact enumeration.

Source layout: `src/combat/dice-math/`. Entry point: `runDiceMath` in
`run-dice-math.ts`.

## Pipeline

```
Step 1  collect dice with     → CollectedDice
        bonuses applied
Step 2  collect modifiers     → Modifier[]
Step 3  decide mode           → fast | per-unit-type
Step 4  split sources by      → SideBuckets
        ADDITIONAL_HIT_POOL

  Fast mode (only ADDITIONAL_HIT_POOL / REROLL):
    Step 5  REROLL pass (per source, if any) → collapse to bucket totals
    per bucket: Binomial(total dice, hit prob) over total hits

  Per-unit-type mode (anything else):
    Step 5         initial per-source binomial
    Step 6a        REROLL pass
    Step 6b        ROLL_TRIGGER pass
    Step 6c        CONDITIONAL_MODIFIER pass
    cross-product attacker × defender branches

Step 7  emit hit pools per bucket → DiceMathBranch[]
```

Effect callbacks declared by `ROLL_TRIGGER` decls (e.g. Strike Wing
Alpha II destroying infantry) are dispatched per branch by the engine
(`_branchesFromMathKernel`) against the freshly-forked branch state, so
when `advance()` returns each branch already reflects the resolved effect.

## Step 1 — Collect dice with bonuses applied

`collectDice(dicePool)` rolls each side's `DicePool` into a per-source map:

```ts
type Source = string // "<variantKey>@<hitValue>x<dicePerUnit>"

interface SideDiceCollection {
  hitValues: Record<Source, number> // 1..10
  diceCounts: Record<Source, [number, number]> // [unitCount, dicePerUnit]
  unitTypes: Record<Source, UnitType> // dice-pool outer key (base type)
}
```

- `dicePerUnit = baseDice + bonusDice` from the `SourcedDiceGroup` tuple.
- Sources collapse only when `(variantKey, hitValue, dicePerUnit)` match
  exactly — galvanized destroyer (4 dice) and normal upgraded destroyer (3
  dice) become two distinct sources, both keyed under variant `DESTROYER`.

The collection is then mutated in place by two bonus-application sub-steps,
implemented in `dice-math/phases/`:

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

| Modifier               | Target spec                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `REROLL`               | `{ key, target: 'MISSES' \| 'ALL', rerollIf? }`                   |
| `CONDITIONAL_MODIFIER` | `{ key, bonus, limit, source? }`                                  |
| `ADDITIONAL_HIT_POOL`  | `{ key, units: UnitType[], transform: (count) => HitPool }`       |
| `ROLL_TRIGGER`         | `{ key, slotId, faces: number[], units?: UnitType[] }` (+ effect) |

Decls with the same `abilityKey` deduplicate to a single modifier:

- `CONDITIONAL_MODIFIER` reads `limit` from the running ability's `uses`
  snapshot (defaults to 1).
- `ROLL_TRIGGER` unions the `unitType` filters from all decls under
  the same key (e.g. one per firing destroyer). An empty filter means
  "every source on the affected side". The first decl's `slotId` wins
  for effect routing; later decls only extend the filter.

## Step 3 — Mode selection

```
canRunFast = every modifier is ADDITIONAL_HIT_POOL or REROLL
```

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

`routing` (defaults to attacker → defender) decides the landing side, so
self-damage abilities can redirect to the firing side.

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

Use tracking: rerolls don't consume `usesDelta` in the current kernel
(REROLL specs don't carry a use counter).

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

For each combined attacker × defender branch:

```
for each PRE bucket on each side:
  count = Σ hits[source] for source in bucket.sources
  if bucket.spec:                          // ADDITIONAL_HIT_POOL
    pools[landingSide].push(spec.transform(count))
  else:                                    // rest bucket
    pools[landingSide].push({ hits: [count, 0], validTargets })
```

`validTargets` comes from the side's main combat target list. Empty
`validTargets` means unrestricted (fast-path hit assignment).

Final branches collapse on identity:
`(pendingHitPools, usesDelta, destroyedUnits, pendingEffects)`.

## Effect dispatch

`_branchesFromMathKernel` clones state per branch, applies `usesDelta`
to `liveAbilities` on owner sides, writes `pendingHitPools`, removes any
`destroyedUnits`, then dispatches each `PendingEffect`. For
`ROLL_TRIGGER` effects, the dispatcher binds a fresh `AbilityContext`
to the branch and invokes `decl.effect(payload.count, ctx)`. Effects
typically call:

- `ctx.api.opponent.destroyUnits(...)` — direct state mutation.
- `ctx.api.{own,opponent}.addPendingHits(count, validTargets?)` — push a
  bonus `HitPool` into the same commit cycle as the main dice-roll
  pool. Used for hit-producing triggers (JNS Hylarim's +2 per natural 9/10).

`addPendingHits` is preferred over `addHits` inside effect callbacks
because `addHits` writes to `hitPools` directly and may schedule a
separate assign-hits step, splitting the roll-trigger contribution
from the dice-roll's main pool. `pendingHitPools` is what
`_commitHitPools` promotes before `BEFORE_ASSIGN_HITS`, so the
contributions land together.
