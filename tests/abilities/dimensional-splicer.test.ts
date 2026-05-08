import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIMENSIONAL_SPLICER', () => {
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

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

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

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Dreadnought sustains the hit
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('destroys ship by DS if it was already damaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
        },
      },
      defender: {
        faction: 'GHOSTS_OF_CREUSS',
        units: { CRUISER: 2 },
        abilities: { DIMENSIONAL_SPLICER: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // DS fires at START_OF_COMBAT → dreadnought already damaged → can't sustain → destroyed
    t.advanceRound()

    expect(t.abilityLog('DIMENSIONAL_SPLICER')).not.toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
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

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.defender.units.FIGHTER).toHaveLength(2)
  })
})
