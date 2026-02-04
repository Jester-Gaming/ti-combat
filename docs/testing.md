# Ability Testing Guide

## Test Framework

- **Vitest 4** with globals enabled (`describe`, `it`, `expect` auto-available)
- Custom matchers loaded from `src/tests/utils/expect.ts` (setup file)
- Run tests: `npm run test:run` (single run) or `npm run test` (watch mode)

## File Naming

- Single ability: `ability-name.test.ts` (kebab-case of the ability key)
- Multiple abilities: names joined with `+`, sorted alphabetically. Example: `bunker+plasma-scoring.test.ts`
- All test files go in `src/tests/`

## Imports

Every test file needs at minimum:

```typescript
import { describe, expect, it } from 'vitest'
import { combatTest } from './utils/combat-test'
```

## The `combatTest()` Factory

Creates a `CombatTest` instance from a config object. The constructor automatically runs `PREPARE` timings.

```typescript
const t = combatTest({
  mode: 'SPACE' | 'GROUND',
  attacker: {
    faction: FactionKey,          // e.g. 'ARBOREC', 'SARDAKK_NORR'
    units: { CRUISER: 2 },        // unit type -> count
    upgrades?: ['CRUISER'],       // unit types to use UPGRADED stats
    abilities?: {                 // ability configs
      ABILITY_KEY: true,          // shorthand: sets { isEnabled: true }
      ABILITY_KEY: { ... },       // explicit params
    },
  },
  defender: { /* same structure */ },
})
```

### Ability params shorthand

- `ABILITY_KEY: true` expands to `{ isEnabled: true }`
- `ABILITY_KEY: { isEnabled: true, strategy: 'BEST' }` passes params directly

## CombatTest API Reference

### State Access

| Property     | Returns           | Description                 |
| ------------ | ----------------- | --------------------------- |
| `t.state`    | `CombatStateData` | Full combat state           |
| `t.attacker` | `SideState`       | Attacker's side state       |
| `t.defender` | `SideState`       | Defender's side state       |
| `t.log`      | `LogEntry[]`      | All accumulated log entries |

### Phase Control

| Method                             | Description                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `t.advanceTo(meta, micro?, hits?)` | Advance through combat, stopping **before** the target phase. Picks outcome matching hits (default 0) |
| `t.advanceRound(hits?)`            | Process one full combat round from current position through END                                       |
| `t.step(round?)`                   | Single advance step, returns all `StateWithProbability[]` outcomes                                    |

### HitsSpec

The `hits` parameter accepts `HitsSpec`:

```typescript
type HitsSpec = number | { attacker?: number; defender?: number }
```

- `number` — match total hits across both sides
- `{ attacker?: n, defender?: n }` — match per-side hits received (missing side defaults to 0)

**Important:** `{ attacker: 1 }` means attacker **receives** 1 hit (from defender dice). To produce N hits on a side, the opposing side needs enough dice-producing units.

### Log Query Methods

| Method                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `t.abilityLog(key)`       | Log entries where path includes `key`                |
| `t.abilityLog(key, side)` | Same, filtered by combat side                        |
| `t.dicePool()`            | Last DICE_POOL entry: `{ attacker, defender }` pools |

For phase system, ability timings, unit stats, factions, and ability keys — see `docs/overview.md`.

## Custom Matcher: `toContainDice`

```typescript
expect(dicePool).toContainDice(unitType, [hitValue, diceCount])
```

Checks that the dice pool for `unitType` contains a dice group matching `[hitValue, diceCount]`. Requires `import './utils/expect'`.

## Test Patterns by Ability Type

### 1. Dice Modifier (hit value changes, extra dice)

Advance to combat START, run a round, then check the logged dice pool.

```typescript
it('modifies combat dice', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 1 },
      abilities: { MY_ABILITY: true },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
  })

  t.advanceTo('SPACE_COMBAT', 'START')
  t.advanceRound()
  const pool = t.dicePool()!

  // Cruiser base combat: [7, 1] -> modified to [6, 1]
  expect(pool.attacker).toContainDice('CRUISER', [6, 1])
})
```

For unit ability dice (bombardment/space cannon/AFB), advance to the right point and check dicePool:

```typescript
// Bombardment dice
t.advanceTo('SPACE_CANNON_DEFENSE') // stops after bombardment processed
const pool = t.dicePool()!
expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])

// Space cannon offense dice
t.advanceTo('AFB') // stops after SCO processed
const pool = t.dicePool()!
expect(pool.defender).toContainDice('PDS', [6, 1])
```

### 2. Sustain Damage / Hit Absorption

Advance to combat, run a round with hits, check `isDamaged` and unit survival.

```typescript
it('absorbs a hit via sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
  })

  t.advanceTo('SPACE_COMBAT', 'START')
  t.advanceRound({ defender: 1 })

  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
})
```

### 3. Unit Destruction (START_OF_COMBAT abilities)

Advance past the ability timing and verify unit counts.

```typescript
it('destroys a unit at start of combat', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 3 },
      abilities: { ASSAULT_CANNON: true },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
  })

  // Advance past START where Assault Cannon fires
  t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

  expect(t.attacker.units.CRUISER).toHaveLength(3)
  expect(t.defender.units.CRUISER).toHaveLength(2)
})
```

### 4. Ability Disabling (losing unit abilities)

Advance through combat and verify that the disabled ability doesn't trigger.

```typescript
it('disables opponent sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'MENTAK_COALITION',
      units: { FLAGSHIP: 1, CRUISER: 1 },
    },
    defender: {
      faction: 'ARBOREC',
      units: { DREADNOUGHT: 1, FIGHTER: 1 },
    },
  })

  t.advanceTo('SPACE_COMBAT', 'START')
  t.advanceRound({ defender: 1 })

  // Dreadnought can't sustain (disabled by Mentak flagship)
  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
})
```

### 5. Ability Completely Disabling a Phase

Advance past the phase and check the logged dice pool.

```typescript
it('disables space cannon entirely', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 2 },
      abilities: { SOLAR_FLARE: true },
    },
    defender: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
  })

  t.advanceTo('AFB') // past SCO
  const pool = t.dicePool()

  // No dice pool logged (phase skipped entirely) or PDS absent
  expect(pool?.defender?.PDS).toBeUndefined()
})
```

### 6. Subtypes (Cavalry-style abilities)

Advance through combat and verify via abilityLog and dice pool.

```typescript
it('creates subtype and modifies dice', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'BARONY_OF_LETNEV',
      units: { CRUISER: 2 },
      abilities: { CAVALRY: { isEnabled: true, unitType: 'CRUISER' } },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
  })

  t.advanceTo('SPACE_COMBAT', 'START')
  t.advanceRound()

  // Verify ability fired
  expect(t.abilityLog('CAVALRY')).toHaveLength(1)

  // Check dice pool from log
  const pool = t.dicePool()!
  // Cavalry Cruiser gets Nomad flagship stats: [4, 2]
  expect(pool.attacker).toContainDice('CRUISER', [4, 2])
})
```

### 7. Hit Reduction (cancel hits)

Use `advanceRound` with hits and verify ability fired + unit survival.

```typescript
it('cancels hits', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 3 },
      abilities: { SHIELDS_HOLDING: { uses: 1 } },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
  })

  t.advanceTo('SPACE_COMBAT', 'START')
  // 3 hits received, Shields Holding cancels 2 → 1 effective hit
  t.advanceRound({ attacker: 3 })

  expect(t.abilityLog('SHIELDS_HOLDING')).toHaveLength(1)
  expect(t.attacker.units.CRUISER).toHaveLength(2)
})
```

### 8. END_OF_COMBAT_ROUND Tests

Use `advanceRound` which processes through END.

```typescript
it('adds infantry at end of round', () => {
  const t = combatTest({
    mode: 'GROUND',
    attacker: {
      faction: 'YIN_BROTHERHOOD',
      units: { MECH: 1 },
    },
    defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
  })

  t.advanceTo('GROUND_COMBAT', 'START')
  t.advanceRound()

  // Ability fires at END_OF_COMBAT_ROUND
  expect(t.attacker.units.INFANTRY).toHaveLength(2)
})
```

### 9. Multi-Round Tests

Call `advanceRound` multiple times.

```typescript
t.advanceTo('SPACE_COMBAT', 'START')
t.advanceRound({ defender: 1 }) // round 1
t.advanceRound({ defender: 1 }) // round 2
```

## Common Assertions

```typescript
// Unit count
expect(t.attacker.units.CRUISER).toHaveLength(3)

// Unit destroyed (type gone)
expect(t.defender.units.FIGHTER).toBeUndefined()

// Unit damaged (sustain used)
expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

// Unit NOT damaged (sustain didn't fire)
expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

// Dice value check
const pool = t.dicePool()!
expect(pool.attacker).toContainDice('CRUISER', [7, 1])

// No dice for a unit type
expect(pool.defender.PDS).toBeUndefined()

// Ability fired
expect(t.abilityLog('MY_ABILITY')).toHaveLength(1)

// Ability did not fire
expect(t.abilityLog('MY_ABILITY')).toHaveLength(0)
```

## Tips

- Use `ARBOREC` as the default "vanilla" faction when you need a side with no special abilities
- `advanceTo()` picks 0-hit outcomes by default, making it deterministic for testing setup abilities
- `advanceTo()` stops **before** the target phase executes
- `advanceRound()` processes from the current position through the END of the combat round
- `dicePool()` returns the **last** logged DICE_POOL entry — be aware that later phases may overwrite earlier ones
- `{ attacker: N }` means attacker **receives** N hits — ensure the defender has enough dice-producing units to generate N hits
- Comment dice calculations inline: `// Cruiser: 7 - 1(ability) = 6`
- Test both positive cases (ability works) and edge cases (ability doesn't trigger when conditions aren't met)
- For abilities with `uses` parameter, test both when uses > 0 and when uses === 0
