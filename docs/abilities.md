# Ability Development Guide

## File Structure

Abilities are organized in `src/data/abilities/` by category:

```
src/data/abilities/
  general/          — core abilities (SETTINGS, UNIT_PRIORITY, ABILITY_ORDER, PRE_DAMAGED)
  technology/       — tech cards (ASSAULT_CANNON, PLASMA_SCORING, ...)
  action-card/      — action cards (BUNKER, MORALE_BOOST, SOLAR_FLARE, ...)
  environment/      — environment effects (NEBULA, ENTROPIC_SCAR)
  agenda/           — agenda cards (CONVENTIONS_OF_WAR, PROPHECY_OF_IXTH, ...)
  relic/            — relics (LIGHTRAIL_ORDNANCE, METALI_VOID_ARMAMENTS, ...)
  unit/             — unit abilities (SUSTAIN_DAMAGE, PLANETARY_SHIELD, DISABLE_PLANETARY_SHIELD)
```

Faction abilities live in `src/data/faction/[faction_name]/` alongside the faction definition.

Each ability is one file (kebab-case matching the key). File exports a single `Ability` object.

## Ability Interface

```typescript
interface Ability<Params extends Record<string, unknown>> {
  key: string // Unique identifier, SCREAMING_SNAKE_CASE
  name: string // Display name for UI
  icon?: string // Raw SVG string for display next to name
  category: string // 'GENERAL' | 'TECHNOLOGY' | 'ACTION_CARD' | 'ENVIRONMENT' | 'AGENDA' | 'FACTION'
  subcategory?: string // For FACTION: 'ABILITY' | 'TECHNOLOGY' | 'BREAKTHROUGH' | 'HERO' | 'UNIT' | 'FLAGSHIP' | 'MECH'
  params: AbilityBaseParams & Params // Default parameter values (includes isEnabled and uses from AbilityBaseParams)
  headerUI?: string & keyof Params // Param key shown in ability header
  readOnly?: boolean // Lock UI (user cannot toggle)
  uiConfig?: UIConfig<Params> // Controls for params in UI
  side?: CombatSide // Restrict to attacker or defender
  context?: CombatMode // Restrict to SPACE or GROUND combat
  sync?: boolean // Both sides share identical config
  exclusiveGroup?: string // Mutually exclusive abilities sharing same group
  onParamSet?: (params, key, value) => params | void // Callback for param changes
  declareParamChange?: (params, settings: SettingsParams) => ParamChange[]
  invoke: AbilityInvoke<Params>[] // Array of timing handlers
}
```

**`params`** — includes `AbilityBaseParams` (`isEnabled: boolean`, `uses: number`) merged with custom `Params`. Example: `params: { isEnabled: false, uses: Infinity, strategy: 'BEST' }`.

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

**`sync: true`** — both sides share identical config. When the user changes params on one side, the other side is automatically updated to match. Useful for environment effects and other abilities where both players share the same setting.

**`exclusiveGroup`** — abilities sharing the same group are mutually exclusive — enabling one disables others in the group.

## Parameters

Define a `Params` type, provide `params` (which includes `AbilityBaseParams`).

Common patterns:

```typescript
// Toggle ability
type Params = { isEnabled: boolean }
params: {
  isEnabled: false,
  uses: Infinity,
}
headerUI: 'isEnabled'

// Uses counter (e.g., action cards x4)
type Params = { uses: number }
params: {
  isEnabled: true,
  uses: 0,
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
CLEANUP               — internal cleanup (resets state between phases)
PREPARE               — once at combat construction
COMMIT_UNITS          — during COMMIT_UNITS phase (ground combat unit commitment)
START_OF_COMBAT       — before first round
START_OF_COMBAT_ROUND — before each round (including first)
BEFORE_UNIT_ABILITY_ROLL — before AFB / bombardment / space cannon dice
AFTER_UNIT_ABILITY_ROLL  — after unit ability dice are rolled (hits assigned to opponent)
BEFORE_DICE_ROLL      — before combat dice
AFTER_DICE_ROLL       — after combat dice are rolled (hits pending, before assignment)
BEFORE_ASSIGN_HITS    — before hit assignment (sustain damage fires here)
AFTER_ASSIGN_HITS_STEP — after hits are assigned and destroyed units processed
WHEN_SUSTAIN_DAMAGE_USE  — triggered immediately when a sustain damage use occurs (before AFTER)
AFTER_SUSTAIN_DAMAGE_USE — triggered immediately after a sustain damage use
DESTROY               — when units are destroyed (internal destroy processing)
WHEN_DESTROY          — when units are destroyed (before AFTER_DESTROY, fires from destroyed unit's ABILITIES)
AFTER_DESTROY         — after units are destroyed
END_OF_COMBAT_ROUND   — after each round
AFTER_COMBAT_ROUND    — after END_OF_COMBAT_ROUND, before CLEANUP_ROUND
END_OF_COMBAT         — when combat ends
CLEANUP_ROUND         — after AFTER_COMBAT_ROUND, resets per-round state (e.g. usedSustainThisRound)
AFTER_ROUND           — after round cleanup
```

### Function Signatures by Timing

**Void timings** (CLEANUP, PREPARE, COMMIT_UNITS, START_OF_COMBAT, START_OF_COMBAT_ROUND, AFTER_UNIT_ABILITY_ROLL, AFTER_DICE_ROLL, BEFORE_ASSIGN_HITS, AFTER_ASSIGN_HITS_STEP, END_OF_COMBAT_ROUND, AFTER_COMBAT_ROUND, END_OF_COMBAT, CLEANUP_ROUND, AFTER_ROUND):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext) => boolean
call: (ctx: AbilityCallContext, params: Params) => void
```

**Dice timings** (BEFORE_DICE_ROLL, BEFORE_UNIT_ABILITY_ROLL):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, dice: DiceReadContext) => boolean
call: (ctx: AbilityCallContext, params: Params, dice: DiceContext) => void
```

**Destroy timings** (DESTROY, WHEN_DESTROY, AFTER_DESTROY):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, units: OwnOpponentContext<Record<UnitType, UnitId[]>>) => boolean
call: (ctx: AbilityCallContext, params: Params, units: OwnOpponentContext<Record<UnitType, UnitId[]>>) => OwnOpponentContext<Record<UnitType, UnitId[]>> | void
```

**Sustain damage timings** (WHEN_SUSTAIN_DAMAGE_USE, AFTER_SUSTAIN_DAMAGE_USE) — context is `UnitId`:

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, unitId: UnitId) => boolean
call: (ctx: AbilityCallContext, params: Params, unitId: UnitId) => void
```

## Context Objects

### AbilityReadContext (in `isCallable`)

Read-only. Cannot modify state.

```typescript
interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: {
    readonly own: SideApi
    readonly opponent: SideApi
  }
  getUnit(): UnitId // Only for unit abilities — throws otherwise
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
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
  logger?: Logger // Append to ability log via logger?.log(...)
  trigger<K extends AbilityTiming>(name: K, context: TimingContextMap[K]): void // Emit trigger event
  getUnit(): UnitId // Only for unit abilities — throws otherwise
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
}
```

`own` / `opponent` are relative to the ability's side, not attacker/defender.

### `getUnit()`

Available on both `AbilityReadContext` and `AbilityCallContext`. Returns the `UnitId` this ability is attached to. Only valid for unit abilities (abilities defined in a unit's `ABILITIES` array). Throws an error if called from a config ability.

```typescript
// Unit ability example — modify own unit state
call: ctx => {
  const unitId = ctx.getUnit()
  ctx.api.own.modifyUnitState(unitId, { isDamaged: true })
}
```

## SideApi

Used in both `isCallable` and `call` contexts. The same `SideApi` class is used for both read and write — write methods are only available during `call` (Immer draft context).

### Read Methods

```typescript
getFaction(): FactionKey
getUnits(unitType: UnitType, options?: { includeVariants: true }): UnitId[]
hasUnit(unitId: UnitId): boolean
hasUnitType(unitType: UnitType, options?: { includeVariants: true }): boolean
countUnits(filter?: UnitType | UnitType[], options?: { includeVariants: true }): number
getPendingHits(): number
getHitPoolValidTargets(): UnitType[]
getActiveBaseTypes(): UnitBaseType[]
getParticipatingUnitTypes(options?: { combatMode?: CombatMode }): UnitType[]
getUnitVariantsOptions(filter?: { include?, exclude?, excludeSubtypes?, combatMode?, includeNonParticipating? }): { label: string, value: string }[]
findUnitByPriority(priority: UnitType[]): UnitId | undefined
getUnitStats(unitTypeOrId: string | UnitId): UnitStats
getVariantKey(unitId: UnitId): string | undefined
getUnitState(unitId: UnitId): UnitState
getUnitBaseType(unitId: UnitId): UnitBaseType
getUnitVariant(unitId: UnitId): UnitVariantId | undefined
getAbilityConfig(key: string): Record<string, unknown>
isUnitAbilityLost(ability: UnitAbility, unitType: string): boolean
isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: string): boolean
```

### Write Methods (available in `call` only)

#### Unit Operations

```typescript
destroyUnits(target: UnitBaseType | UnitId | UnitId[]): void  // Destroy by type (first found), UnitId, or UnitId[]; array variant fires destroy abilities once
removeUnits(target: UnitBaseType | UnitId | UnitId[]): void   // Remove without triggering destroy abilities
placeUnits(unitsToAdd: Partial<Record<UnitBaseType, number>>): void
modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void   // Modify stats for all units of a type
modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void // Modify per-unit mutable state
```

#### Hit Operations

```typescript
reduceHits(amount: number): void
addHits(hits: number, validTargets: UnitType[]): void
modifyHitValue(amount: number): void                             // All dice
modifyHitValue(amount: number, unit: UnitId): void               // By UnitId
modifyHitValue(amount: number, source: UnitType): void           // By unit type
modifyHitValue(amount: number, filter: (source: UnitType) => boolean): void
```

#### Unit Ability Restrictions

Two-layer system — **lost** (ability removed) vs **cannotBeUsed** (ability present but blocked):

```typescript
// Disable ability for all units, specific type, or category
setUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
removeUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
setUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
removeUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
```

`reason` is the ability key that caused the restriction. Used to cleanly remove restrictions without affecting other abilities' restrictions.

`target` can be a specific `UnitBaseType` (e.g., `'MECH'`) or a `UnitCategory` (`'SHIPS'`, `'NON_FIGHTER_SHIPS'`, `'GROUND_FORCES'`, `'STRUCTURES'`). Categories are resolved at check time, so changes to category membership are automatically reflected.

**lost vs cannotBeUsed**: "lost" means the ability is gone (e.g., Publicize Weapon Schematics removes War Sun sustain). "cannotBeUsed" means it's still there but blocked (e.g., Fourth Moon prevents sustain from firing). Both are checked by Sustain Damage before firing.

#### Subtype Operations

```typescript
addSubtype(variantId: UnitType, subtype: UnitVariantId, statsFactory?: (parentStats: UnitStats) => UnitStats): void
removeSubtype(variantId: UnitType, subtype: UnitVariantId): void
```

#### Ability Config Mutations

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
get(source: string): readonly SourcedDiceGroup[] | undefined
isEmpty(): boolean
```

### DiceApi (in `call`, extends DiceReadApi)

```typescript
// Add dice count to existing group
addDiceCount(count: number): void                           // To best unit (lowest hit value)
addDiceCount(count: number, strategy: 'BEST' | 'WORST'): void
addDiceCount(count: number, source: UnitBaseType): void     // To specific unit type
addDiceCount(count: number, unit: UnitId): void             // To specific unit

// Add new dice group to pool
addDiceGroup(source: string, unit: UnitId, diceGroup: DiceGroup): void
```

Dice format: `[hitValue, diceCount, sourceUnit]` (SourcedDiceGroup). Hit value is the threshold — needs to roll >= hitValue to hit.

## Registration

### Category Abilities (technology, action-card, etc.)

1. Create ability file in `src/data/abilities/[category]/`
2. Export ability object
3. Add import + array entry in `src/data/abilities/[category]/index.ts`

Example — adding to technology:

```typescript
// src/data/abilities/technology/my-tech.ts
import { type Ability } from '@/combat'

type Params = { isEnabled: boolean }

export const myTech: Ability<Params> = {
  key: 'MY_TECH',
  name: 'My Tech',
  category: 'TECHNOLOGY',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  invoke: [
    /* ... */
  ],
}
```

```typescript
// src/data/abilities/technology/index.ts
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
    technology: [factionTech], // Faction-specific technology
    unit: [unitAbility], // Unit-attached abilities
    promissory: [promNote], // Available to all factions
    agent: [agentAbility], // Available to all factions
    commander: [commanderAbility], // Available to all factions
    hero: [heroAbility], // Available to all factions
    breakthrough: [breakthrough], // Breakthrough abilities
  },
  units: {
    /* ... */
  },
}
```

`faction` abilities only appear for that faction. `promissory`, `agent`, `commander`, `hero`, and `breakthrough` are collected across all factions and available to everyone.

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
        ctx.api.opponent.setUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', 'FOURTH_MOON', 'SHIPS')
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
      items: ctx.api.opponent.getUnitVariantsOptions({ exclude: ['FIGHTER'] }),
    },
  ]
}
```

UI config item types:

| Type            | Param Type | Use Case                                          |
| --------------- | ---------- | ------------------------------------------------- |
| `checkbox`      | `boolean`  | Toggle                                            |
| `number`        | `number`   | Counter with optional min/max                     |
| `select`        | `string`   | Dropdown                                          |
| `order-list`    | `string[]` | Reorderable list                                  |
| `priority-list` | `string[]` | Reorderable priority list with ordering logic     |
| `checkbox-list` | `string[]` | Multi-select                                      |
| `number-list`   | items[]    | Per-item numeric values (items with optional max) |

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

1. During `call`, the ability calls `ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', unitId)` then `ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', unitId)`
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
    isCallable: (params, ctx, unitId) => { ... },
    call: (ctx, params, unitId) => { ... },
  },
]
```

## Checklist for New Abilities

1. Create file in the correct category directory
2. Define `Params` type and `params` (including `isEnabled` and `uses` from AbilityBaseParams)
3. Choose correct timing(s) — see [Timing System](#timing-system)
4. Implement `isCallable` guard if ability is conditional
5. Implement `call` with the correct signature for the timing
6. Add `headerUI` — every ability must be visible in the UI. For always-on abilities with no user controls, use `params: { isEnabled: true, uses: Infinity }`, `headerUI: 'isEnabled'`, and `readOnly: true`
7. Add `uiConfig` if ability has configurable params beyond the header
8. Add `side` if ability is side-restricted
9. Register in the category's `index.ts` (or faction's `index.ts`)
10. Write tests (see `docs/testing.md`)
11. Mark ability as `[x]` in `docs/abilities-list.md`
