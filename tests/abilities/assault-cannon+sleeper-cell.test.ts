import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ASSAULT_CANNON + SLEEPER_CELL', () => {
  it('Assault Cannon fires before Sleeper Cell activates — kill not copied', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: true,
          ASSAULT_CANNON: true,
          ABILITY_ORDER: {
            startOfCombat: ['ASSAULT_CANNON', 'SLEEPER_CELL'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    // Assault Cannon resolves first at START_OF_COMBAT,
    // Sleeper Cell isn't activated when the kill happens
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from Assault Cannon
    expect(t.attacker.units.CRUISER).toHaveLength(3) // No copy — Sleeper Cell wasn't active yet
  })

  it('Sleeper Cell activates before Assault Cannon — kill is copied', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: true,
          ASSAULT_CANNON: true,
          ABILITY_ORDER: {
            startOfCombat: ['SLEEPER_CELL', 'ASSAULT_CANNON'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    // Sleeper Cell activates first, then Assault Cannon kills —
    // the kill triggers DESTROY and Sleeper Cell copies it
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from Assault Cannon
    expect(t.attacker.units.CRUISER).toHaveLength(4) // 3 + 1 copied
  })
})
