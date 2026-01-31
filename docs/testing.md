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

| Method                             | Description                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `t.setPhase(meta, micro)`          | Set phase directly (no simulation)                                                                                   |
| `t.advanceTo(meta, micro?, hits?)` | Advance through combat picking the branch with the given total hits (default 0). Throws if no matching branch exists |
| `t.step(round?)`                   | Single advance step, returns all `StateWithProbability[]` outcomes                                                   |

### Timing Execution

| Method                       | Description                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `t.runTiming(timing)`        | Run abilities at one or more timings                                                    |
| `t.runDiceTiming(hitSource)` | Collect dice, run BEFORE_DICE_ROLL/BEFORE_UNIT_ABILITY_ROLL, return modified dice pools |

### State Manipulation

| Method                                  | Description                             |
| --------------------------------------- | --------------------------------------- |
| `t.addHits(side, count, validTargets?)` | Add pending hits to a side              |
| `t.assignHits()`                        | Resolve hit assignment (destroys units) |
| `t.destroyUnit(side, unitType, index?)` | Remove a unit and run AFTER_DESTROY     |

For phase system, ability timings, unit stats, factions, and ability keys — see `docs/overview.md`.

## HitSource to Timing Mapping

| HitSource        | Timing triggered by `runDiceTiming()` |
| ---------------- | ------------------------------------- |
| `'COMBAT'`       | `BEFORE_DICE_ROLL`                    |
| `'AFB'`          | `BEFORE_UNIT_ABILITY_ROLL`            |
| `'BOMBARDMENT'`  | `BEFORE_UNIT_ABILITY_ROLL`            |
| `'SPACE_CANNON'` | `BEFORE_UNIT_ABILITY_ROLL`            |

## Custom Matcher: `toContainDice`

```typescript
expect(dicePool).toContainDice(unitType, [hitValue, diceCount])
```

Checks that the dice pool for `unitType` contains a dice group matching `[hitValue, diceCount]`. Requires `import './utils/expect'`.

## Test Patterns by Ability Type

### 1. Dice Modifier (hit value changes, extra dice)

Set phase to the relevant `DICE_ROLL` micro-phase, call `runDiceTiming()` with the appropriate hit source, assert dice values.

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

  t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
  const dice = t.runDiceTiming('COMBAT')

  // Cruiser base combat: [7, 1] -> modified to [6, 1]
  expect(dice.attacker).toContainDice('CRUISER', [6, 1])
})
```

For bombardment/space cannon/AFB dice:

```typescript
t.setPhase('BOMBARDMENT', 'DICE_ROLL')
const dice = t.runDiceTiming('BOMBARDMENT')

t.setPhase('SPACE_CANNON_OFFENSE', 'DICE_ROLL')
const dice = t.runDiceTiming('SPACE_CANNON')

t.setPhase('AFB', 'DICE_ROLL')
const dice = t.runDiceTiming('AFB')
```

### 2. Sustain Damage / Hit Absorption

Set phase to `ASSIGN_HITS`, add hits, run `BEFORE_ASSIGN_HITS`, check `isDamaged` state and pending hit reduction.

```typescript
it('absorbs a hit via sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
  })

  t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
  t.addHits('defender', 1)
  t.runTiming('BEFORE_ASSIGN_HITS')

  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

  t.assignHits()
  expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
})
```

### 3. Unit Destruction (START_OF_COMBAT abilities)

Use `advanceTo()` to advance past the ability timing and verify unit counts.

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

  t.advanceTo('AFB')

  expect(t.attacker.units.CRUISER).toHaveLength(3)
  expect(t.defender.units.CRUISER).toHaveLength(2)
})
```

### 4. Ability Disabling (losing unit abilities)

Test that an ability prevents another ability from working. The disabling ability fires at PREPARE or START_OF_COMBAT and uses `setUnitAbilityLost`/`setUnitAbilityCannotBeUsed`.

```typescript
it('disables opponent sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'MENTAK_COALITION',
      units: { FLAGSHIP: 1, CRUISER: 1 },
    },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1, FIGHTER: 1 } },
  })

  t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
  t.addHits('defender', 1)
  t.runTiming('BEFORE_ASSIGN_HITS')

  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
})
```

### 5. Ability Completely Disabling a Phase

When an ability removes all dice from a phase (e.g., Solar Flare disabling space cannon):

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

  t.setPhase('SPACE_CANNON_OFFENSE', 'DICE_ROLL')
  const dice = t.runDiceTiming('SPACE_CANNON')

  expect(dice.defender.PDS).toBeUndefined()
})
```

### 6. Subtypes (Cavalry-style abilities)

Run the timings that create subtypes, then verify subtypes and dice behavior.

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

  t.runTiming(['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'])
  expect(t.attacker.units.CRUISER![0].subtypes).toContain('Cavalry')

  t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
  const dice = t.runDiceTiming('COMBAT')
  expect(dice.attacker).toContainDice('CRUISER', [4, 1])
})
```

### 7. Destroyed Unit Triggers (AFTER_DESTROY)

Use `destroyUnit()` which automatically runs AFTER_DESTROY, then verify the post-destruction effects.

```typescript
it('re-enables sustain after unit destroyed', () => {
  const t = combatTest({
    /* ... */
  })

  t.destroyUnit('defender', 'FIGHTER')

  t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
  t.addHits('defender', 1)
  t.runTiming('BEFORE_ASSIGN_HITS')

  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
})
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

// Dice value check (requires import './utils/expect')
expect(dice.attacker).toContainDice('CRUISER', [7, 1])

// No dice for a unit type
expect(dice.defender.PDS).toBeUndefined()

// Subtype check
expect(t.attacker.units.CRUISER![0].subtypes).toContain('Cavalry')
```

## Tips

- Use `ARBOREC` as the default "vanilla" faction when you need a side with no special abilities
- `advanceTo()` picks 0-hit outcomes, making it deterministic for testing setup abilities
- `runDiceTiming()` does NOT roll dice — it collects dice pools and runs modifier abilities, returning the final dice configuration for assertions
- Comment dice calculations inline: `// Cruiser: 7 - 1(ability) = 6`
- Test both positive cases (ability works) and edge cases (ability doesn't trigger when conditions aren't met)
- For abilities with `uses` parameter, test both when uses > 0 and when uses === 0
