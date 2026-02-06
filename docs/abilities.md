# Ability Development Guide

## File Structure

Abilities are organized in `src/combat/abilities/list/` by category:

```
src/combat/abilities/list/
  general/          — core abilities (SETTINGS, SUSTAIN_DAMAGE, UNIT_PRIORITY, PLANETARY_SHIELD)
  technology/       — tech cards (ASSAULT_CANNON, PLASMA_SCORING, ...)
  action-card/      — action cards (BUNKER, MORALE_BOOST, SOLAR_FLARE, ...)
  environment/      — environment effects (NEBULA, ENTROPIC_SCAR)
  agenda/           — agenda cards (CONVENTIONS_OF_WAR, PROPHECY_OF_IXTH, ...)
```

Faction abilities live in `src/data/faction/[faction_name]/` alongside the faction definition.

Each ability is one file (kebab-case matching the key). File exports a single `Ability` object.

## Ability Interface

```typescript
interface Ability<Params extends Record<string, unknown>> {
  key: string // Unique identifier, SCREAMING_SNAKE_CASE
  name: string // Display name for UI
  category: string // 'GENERAL' | 'TECHNOLOGY' | 'ACTION_CARD' | 'ENVIRONMENT' | 'AGENDA' | 'FACTION'
  subcategory?: string // For FACTION abilities: 'ABILITY' | 'TECHNOLOGY' | 'BREAKTHROUGH' | 'HERO' | 'UNIT'
  defaultParams?: Params // Default parameter values
  headerUI?: string & keyof Params // Param key shown in ability header
  readOnly?: boolean // Lock UI (user cannot toggle)
  uiConfig?: UIConfig<Params> // Controls for params in UI
  side?: CombatSide // Restrict to attacker or defender
  context?: CombatMode // Restrict to SPACE or GROUND combat
  declareParamChange?: (params: Params) => ParamChange[]
  invoke: AbilityInvoke<Params>[] // Array of timing handlers
}
```

**`headerUI`** — renders a control in the ability header row. Boolean params show a checkbox, number params show a numeric input. Most abilities use `headerUI: 'isEnabled'` or `headerUI: 'uses'`.

**`readOnly: true`** — ability appears in UI but cannot be toggled off. Used for always-on faction abilities (e.g., Fragile, Unrelenting).

**`context`** — restricts the ability to a specific combat mode. When set, the ability is skipped during combat if the mode doesn't match, and dimmed (opacity 0.5) in the UI. The ability remains fully interactive when dimmed.

```typescript
context: 'SPACE' // Only fires during space combat
context: 'GROUND' // Only fires during ground combat
// omit for abilities that work in both modes
```

Note: This is the **ability-level** `context` (combat mode). Don't confuse with the **invoke-level** `context` (meta-phase), which restricts individual invokes to specific phases like `'AFB'` or `'BOMBARDMENT'`.

**`side`** — restricts which side can use the ability:

```typescript
side: 'attacker' // Only available to the attacker
side: 'defender' // Only available to the defender
```

## Parameters

Define a `Params` type, provide `defaultParams`.

Common patterns:

```typescript
// Toggle ability
type Params = { isEnabled: boolean }
defaultParams: {
  isEnabled: false
}
headerUI: 'isEnabled'

// Uses counter (e.g., action cards x4)
type Params = { uses: number }
defaultParams: {
  uses: 0
}
headerUI: 'uses'

// Custom params with priority list
type Params = {
  isEnabled: boolean
  targetPriority: UnitType[]
}
```

In tests, `ABILITY_KEY: true` is shorthand for `{ isEnabled: true }`.

## Invoke

The `invoke` array defines when and how the ability fires. Each entry targets one timing:

```typescript
invoke: [
  {
    timing: AbilityTiming,         // When to fire
    context?: MetaPhase | MetaPhase[],  // Restrict to specific meta-phases
    side?: 'OWN' | 'OPPONENT',    // Filter by trigger side (see Trigger System)
    isCallable?: (...) => boolean, // Guard (optional, default: always callable)
    call: (...) => void,           // Execution
  }
]
```

**`side: 'OWN' | 'OPPONENT'`** — filters the invoke by which side caused the trigger. Only meaningful for triggered timings (e.g., `AFTER_SUSTAIN_DAMAGE_USE`). `'OWN'` means the invoke fires only for the side that triggered the event. `'OPPONENT'` means it fires only for the other side. Omit for no filtering (fires for both sides).

**`context`** — restricts invoke to specific meta-phases. Only fires when `state.currentPhase.meta` matches:

```typescript
context: 'AFB' // Only during AFB phase
context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE'] // During either phase
```

## Timing System

Timings define when abilities fire. They run in this order during combat:

```
PREPARE               — once at combat construction
START_OF_COMBAT       — before first round
START_OF_COMBAT_ROUND — before each round (including first)
BEFORE_UNIT_ABILITY_ROLL — before AFB / bombardment / space cannon dice
AFTER_UNIT_ABILITY_ROLL  — after unit ability dice are rolled (hits assigned to opponent)
BEFORE_DICE_ROLL      — before combat dice
BEFORE_ASSIGN_HITS    — before hit assignment (sustain damage fires here)
WHEN_SUSTAIN_DAMAGE_USE  — triggered immediately when a sustain damage use occurs (before AFTER)
AFTER_SUSTAIN_DAMAGE_USE — triggered immediately after a sustain damage use
WHEN_DESTROY          — when units are destroyed (before AFTER_DESTROY, fires from destroyed unit's ABILITIES)
AFTER_DESTROY         — after units are destroyed
END_OF_COMBAT_ROUND   — after each round
END_OF_COMBAT         — when combat ends
AFTER_ROUND           — after round cleanup
```

### Function Signatures by Timing

**Void timings** (PREPARE, START_OF_COMBAT, START_OF_COMBAT_ROUND, AFTER_UNIT_ABILITY_ROLL, BEFORE_ASSIGN_HITS, END_OF_COMBAT_ROUND, END_OF_COMBAT, AFTER_ROUND):

> Note: `WHEN_SUSTAIN_DAMAGE_USE` and `AFTER_SUSTAIN_DAMAGE_USE` have `Unit` context type but are **triggered timings** — they fire automatically when sustain damage is used via `ctx.trigger()`. Their context is the sustaining unit. They use the same void-style signature (context is not passed to the invoke). `WHEN_` fires before `AFTER_`.

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext) => boolean
call: (ctx: AbilityCallContext, params: Params) => void
```

**Dice timings** (BEFORE_DICE_ROLL, BEFORE_UNIT_ABILITY_ROLL):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, dice: DiceReadContext) => boolean
call: (ctx: AbilityCallContext, params: Params, dice: DiceContext) => void
```

**Units timings** (WHEN_DESTROY, AFTER_DESTROY):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, units: OwnOpponentContext<DestroyedUnit[]>) => boolean
call: (ctx: AbilityCallContext, params: Params, units: OwnOpponentContext<DestroyedUnit[]>) => OwnOpponentContext<DestroyedUnit[]> | void
```

## Context Objects

### AbilityReadContext (in `isCallable`)

Read-only. Cannot modify state.

```typescript
interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: {
    readonly own: SideReadApi
    readonly opponent: SideReadApi
  }
  getUnit(): Unit // Only for unit abilities — throws otherwise
}
```

### AbilityCallContext (in `call`)

Mutable. State is an Immer draft.

```typescript
interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: {
    own: SideApi // Full read-write API
    opponent: SideApi
  }
  log(...data: unknown[]): void // Append to ability log entry
  trigger(name: keyof TriggerEventMap): void // Emit trigger event (processed after produce)
  getUnit(): Unit // Only for unit abilities — throws otherwise (returns Immer draft)
}
```

`own` / `opponent` are relative to the ability's side, not attacker/defender.

### `getUnit()`

Available on both `AbilityReadContext` and `AbilityCallContext`. Returns the unit instance this ability is attached to. Only valid for unit abilities (abilities defined in a unit's `ABILITIES` array). Throws an error if called from a config ability.

In `call`, the returned unit is an Immer draft — mutations are applied directly:

```typescript
// Unit ability example — modify own unit
call: ctx => {
  const unit = ctx.getUnit()
  // unit is the Immer draft of the unit this ability belongs to
  ctx.api.own.modifyUnit(unit, { isDamaged: true })
}
```

## SideReadApi

Available in both `isCallable` and `call`:

```typescript
getFaction(): FactionKey
getUnits(): Partial<Record<UnitType, Unit[]>>
getUnits(unitType: UnitType): Unit[]
hasUnit(unitType: UnitType): boolean
countUnits(filter?: ReadonlySet<UnitType>): number
getPendingHits(): number
getHitPoolValidTargets(): UnitType[]
getParticipatingUnitTypes(options?: { combatMode?: CombatMode }): UnitType[]
getParticipatingVariants(filter?: { include?: UnitType[], exclude?: UnitType[], excludeSubtypes?: string[], combatMode?: CombatMode }): string[]
getParticipatingVariantsOptions(filter?: { ... same as above }): { label: string, value: string }[]  // For uiConfig items
findUnit(unitType: UnitType, predicate: Partial<UnitState>): { unit: Unit, index: number } | undefined
findUnitByPriority(priority: string[]): Unit | undefined
isUnitAbilityLost(ability: UnitAbility, unitType: UnitType): boolean
isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType): boolean
```

## SideApi (extends SideReadApi)

Additional write methods available in `call`:

### Unit Operations

```typescript
destroyUnit(unit: Unit): void                          // By reference
destroyUnit(unitType: UnitType): void                  // Destroy first of type
destroyUnit(unitType: UnitType, index: number): void   // Destroy specific index
destroyUnit(unitTypes: UnitType[]): void               // Destroy first of each type
addUnit(units: Partial<Record<UnitType, number>>): void
modifyUnit(unitType: UnitType, index: number, updates: Partial<Unit>): void
modifyUnit(unitType: UnitType, updates: Partial<Unit>): void  // First of type
modifyUnit(unit: Unit, updates: Partial<Unit>): void          // By reference
```

### Hit Operations

```typescript
reduceHits(amount: number): void
addHits(hits: number, validTargets: UnitType[]): void
```

### Unit Ability Restrictions

Two-layer system — **lost** (ability removed) vs **cannotBeUsed** (ability present but blocked):

```typescript
// Disable ability for all units or specific type
setUnitAbilityLost(ability: UnitAbility, reason: string, unitType?: UnitType): void
removeUnitAbilityLost(ability: UnitAbility, reason: string, unitType?: UnitType): void
setUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, unitType?: UnitType): void
removeUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, unitType?: UnitType): void
```

`reason` is the ability key that caused the restriction. Used to cleanly remove restrictions without affecting other abilities' restrictions.

**lost vs cannotBeUsed**: "lost" means the ability is gone (e.g., Publicize Weapon Schematics removes War Sun sustain). "cannotBeUsed" means it's still there but blocked (e.g., Fourth Moon prevents sustain from firing). Both are checked by Sustain Damage before firing.

### Subtype Operations

```typescript
addSubtype(unitType: UnitType, index: number, subtype: string): void
removeSubtype(unitType: UnitType, index: number, subtype: string): void
```

### Ability Config Mutations

```typescript
// Update own ability's params (key inferred from current ability)
updateAbilityConfig(updates: Record<string, unknown>): void

// Update another ability's params by key
updateAbilityConfig(key: string, updates: Record<string, unknown>): void
```

## Dice API

### DiceReadApi (in `isCallable`)

```typescript
getAll(): DicePool
get(source: UnitType): readonly SourcedDiceGroup[] | undefined
count(): number
isEmpty(): boolean
```

### DiceApi (in `call`, extends DiceReadApi)

```typescript
// Modify hit values (lower = better, minimum 1)
modifyHitValue(amount: number): void                             // All dice
modifyHitValue(amount: number, unit: Unit): void                 // By unit ref
modifyHitValue(amount: number, source: UnitType): void           // By unit type
modifyHitValue(amount: number, filter: (source: UnitType) => boolean): void

// Add dice count to existing group
addDiceCount(count: number): void                           // To best unit (lowest hit value)
addDiceCount(count: number, strategy: 'BEST' | 'WORST'): void
addDiceCount(count: number, source: UnitType): void         // To specific unit type

// Add new dice group to pool
addDiceGroup(source: UnitType, unit: Unit, diceGroup: DiceGroup): void
```

Dice format: `[hitValue, diceCount, sourceUnit]` (SourcedDiceGroup). Hit value is the threshold — needs to roll >= hitValue to hit.

## Registration

### Category Abilities (technology, action-card, etc.)

1. Create ability file in `src/combat/abilities/list/[category]/`
2. Export ability object
3. Add import + array entry in `src/combat/abilities/list/[category]/index.ts`

Example — adding to technology:

```typescript
// src/combat/abilities/list/technology/my-tech.ts
import type { Ability } from '../../types'

type Params = { isEnabled: boolean }

export const myTech: Ability<Params> = {
  key: 'MY_TECH',
  name: 'My Tech',
  category: 'TECHNOLOGY',
  defaultParams: { isEnabled: false },
  headerUI: 'isEnabled',
  invoke: [
    /* ... */
  ],
}
```

```typescript
// src/combat/abilities/list/technology/index.ts
import { myTech } from './my-tech'
export default [, /* ...existing */ myTech]
```

### Faction Abilities

Faction abilities are registered in the faction's `index.ts`:

```typescript
// src/data/faction/my_faction/index.ts
import type { Faction } from '@/types'
import { myAbility } from './my-ability'

export const my_faction: Faction = {
  name: 'My Faction',
  abilities: {
    faction: [myAbility], // Only available to this faction
    promissory: [promNote], // Available to all factions
    agent: [agentAbility], // Available to all factions
    commander: [commanderAbility], // Available to all factions
  },
  units: {
    /* ... */
  },
}
```

`faction` abilities only appear for that faction. `promissory`, `agent`, and `commander` are collected across all factions and available to everyone.

### Unit Abilities

Abilities attached to specific units via `ABILITIES` array in unit stats. These fire from living units (or destroyed units for AFTER_DESTROY):

```typescript
// src/data/faction/mentak_coalition/fourth-moon.ts
export const fourthMoon: Ability = {
  key: 'FOURTH_MOON',
  name: 'Fourth Moon',
  category: 'FACTION',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', 'FOURTH_MOON')
      },
    },
  ],
}

// In faction definition:
units: {
  FLAGSHIP: {
    BASE: {
      COMBAT: [7, 2],
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true },
      ABILITIES: [fourthMoon],  // Attached to the unit
    },
  },
}
```

## UI Configuration

`uiConfig` controls which params appear in the expandable ability panel:

```typescript
// Static
uiConfig: [
  { key: 'isEnabled', label: 'Enable', type: 'checkbox' },
  { key: 'uses', label: 'Uses', type: 'number', min: 0, max: 10 },
  { key: 'strategy', label: 'Strategy', type: 'select', items: [
    { label: 'Best', value: 'BEST' },
    { label: 'Worst', value: 'WORST' },
  ]},
  { key: 'targetPriority', label: 'Targets', type: 'order-list', items: [...] },
  { key: 'units', label: 'Units', type: 'checkbox-list', items: [...] },
]

// Dynamic (context-aware)
uiConfig: (ctx, params) => {
  return [
    {
      key: 'targetPriority',
      label: 'Target Priority',
      type: 'order-list',
      items: ctx.api.opponent.getParticipatingVariantsOptions({ exclude: ['FIGHTER'] }),
    },
  ]
}
```

UI config item types:

| Type            | Param Type | Use Case                      |
| --------------- | ---------- | ----------------------------- |
| `checkbox`      | `boolean`  | Toggle                        |
| `number`        | `number`   | Counter with optional min/max |
| `select`        | `string`   | Dropdown                      |
| `order-list`    | `string[]` | Reorderable priority list     |
| `checkbox-list` | `string[]` | Multi-select                  |

## Resolution Order

Abilities are resolved in alternating fashion — attacker goes first, then defender, then attacker, continuing until both sides skip consecutively. Each side resolves one ability per turn.

For a given timing, the tracker ensures:

- Config abilities fire at most once per timing phase
- Unit abilities fire once per unit instance

If an ability destroys units (and the timing is not AFTER_DESTROY), the system automatically runs `AFTER_DESTROY` for any destroyed units.

## Trigger System

Abilities can emit **trigger events** via `ctx.trigger()` during their `call`. Triggers are processed immediately after the ability's `produce()` completes, before `AFTER_DESTROY` checks.

Currently supported triggers:

| Trigger Name               | Emitted By     | Description                                           |
| -------------------------- | -------------- | ----------------------------------------------------- |
| `WHEN_SUSTAIN_DAMAGE_USE`  | Sustain Damage | Fires immediately when a unit sustains (before AFTER) |
| `AFTER_SUSTAIN_DAMAGE_USE` | Sustain Damage | Fires immediately after a unit sustains               |

### How Triggers Work

1. During `call`, the ability calls `ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE')` then `ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE')`
2. After `produce()`, the system runs `runAbilities(...)` for each trigger sequentially — `WHEN_` resolves fully before `AFTER_` begins
3. Invokes with `side: 'OWN'` fire only for the trigger side; `side: 'OPPONENT'` fire only for the other side
4. The trigger side goes first in the alternating resolution loop
5. Abilities in triggered windows cannot emit new triggers (recursion prevention)

### Example: Reacting to Sustain Damage

```typescript
invoke: [
  {
    timing: 'AFTER_SUSTAIN_DAMAGE_USE',
    side: 'OPPONENT', // React when opponent sustains
    isCallable: (params, ctx) => { ... },
    call: (ctx, params) => { ... },
  },
]
```

## Checklist for New Abilities

1. Create file in the correct category directory
2. Define `Params` type and `defaultParams`
3. Choose correct timing(s) — see [Timing System](#timing-system)
4. Implement `isCallable` guard if ability is conditional
5. Implement `call` with the correct signature for the timing
6. Add `headerUI` — every ability must be visible in the UI. For always-on abilities with no user controls, use `params: { isEnabled: true }`, `headerUI: 'isEnabled'`, and `readOnly: true`
7. Add `uiConfig` if ability has configurable params beyond the header
8. Add `side` if ability is side-restricted
9. Register in the category's `index.ts` (or faction's `index.ts`)
10. Write tests (see `docs/testing.md`)
11. Mark ability as `[x]` in `docs/abilities-list.md`
