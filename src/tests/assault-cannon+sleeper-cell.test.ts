import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ASSAULT_CANNON + SLEEPER_CELL', () => {
  it('Assault Cannon fires before Sleeper Cell activates — kill not copied', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: true,
          ASSAULT_CANNON: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    // Assault Cannon (technology) resolves before Sleeper Cell (faction hero)
    // at START_OF_COMBAT, so Sleeper Cell isn't activated when the kill happens
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(2) // 3 - 1 from Assault Cannon
    expect(t.attacker.units.CRUISER).toHaveLength(3) // No copy — Sleeper Cell wasn't active yet
  })

  it('copies ships destroyed in combat rounds after activation', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: true,
          ASSAULT_CANNON: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: Assault Cannon kill not copied, but combat hits ARE copied
    t.advanceRound({ defender: 1 })

    // Assault Cannon destroyed 1 + combat destroyed 1 = defender lost 2
    expect(t.defender.units.CRUISER).toHaveLength(1)
    // Sleeper Cell copies the combat kill (not the Assault Cannon kill)
    expect(t.attacker.units.CRUISER).toHaveLength(4) // 3 + 1
  })
})
