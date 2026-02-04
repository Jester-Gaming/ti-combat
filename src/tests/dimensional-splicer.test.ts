import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIMENSIONAL_SPLICER', () => {
  it('destroys a ship that cannot sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('damages a ship with sustain damage instead of destroying it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Dreadnought sustains the hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not fire when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('can target a fighter', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.FIGHTER).toHaveLength(2)
  })

  it('only targets ships, not ground forces', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 1 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Infantry should not be targeted — they are not ships
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
