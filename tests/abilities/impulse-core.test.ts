import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('IMPULSE_CORE', () => {
  it('destroys own destroyer to hit opponent non-fighter ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    // START_OF_COMBAT fires before DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('IMPULSE_CORE').length).toBeGreaterThan(0)
  })

  it('damages a ship with sustain damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not fire when only fighters available (no checked targets)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // No non-fighter ships to target — ability does not fire
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.FIGHTER).toHaveLength(3)
    expect(t.abilityLog('IMPULSE_CORE')).toHaveLength(0)
  })

  it('does not fire when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('IMPULSE_CORE')).toHaveLength(0)
  })

  it('does not fire when no cruiser or destroyer available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('IMPULSE_CORE')).toHaveLength(0)
  })

  it('prefers non-fighter ship over fighter', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    // Non-fighter ship targeted, not fighter
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.defender.units.FIGHTER).toHaveLength(2)
  })

  it('fires only once at start of combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 2, CRUISER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    t.advanceRound()

    // Only fires once (START_OF_COMBAT, not per round)
    expect(t.abilityLog('IMPULSE_CORE')).not.toHaveLength(0)
    // Only 1 destroyer sacrificed
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
  })
})
