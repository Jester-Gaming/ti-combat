import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DEVOTION', () => {
  it('destroys own destroyer to produce a hit against opponent ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // Destroyer sacrificed, opponent loses a cruiser
    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('DEVOTION').length).toBeGreaterThan(0)
  })

  it('destroys own cruiser when no destroyer available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // One cruiser sacrificed
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('damages a ship with sustain damage instead of destroying it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
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

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('DEVOTION')).toHaveLength(0)
  })

  it('does not fire when no cruiser or destroyer available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('DEVOTION')).toHaveLength(0)
  })

  it('fires each round when units are available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 2, CRUISER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound() // round 1: sacrifice 1 destroyer
    t.advanceRound() // round 2: sacrifice 1 destroyer

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    // Fires each round — 2 sacrifice+destroy cycles
    expect(t.abilityLog('DEVOTION').length).toBeGreaterThanOrEqual(2)
  })
})
