import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ASSAULT_CANNON + THE_ALASTOR', () => {
  // Alastor resolves first → Infantry participates →
  // defender AC can target Infantry (cheapest participating unit)
  it('defender AC kills Infantry when Alastor resolves first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 2, INFANTRY: 2 },
        abilities: {
          ASSAULT_CANNON: true,
          ABILITY_ORDER: { startOfCombat: ['THE_ALASTOR', 'ASSAULT_CANNON'] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 5 },
        abilities: { ASSAULT_CANNON: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Alastor fired → Infantry participates → defender AC targets Infantry
    // (Infantry is cheapest participating non-fighter, 'asc' sort default)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(2)
  })

  // AC resolves first → Infantry not participating yet →
  // defender AC targets Dreadnought instead
  it('defender AC kills Dreadnought when AC resolves first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, DREADNOUGHT: 2, INFANTRY: 2 },
        abilities: {
          ASSAULT_CANNON: true,
          ABILITY_ORDER: { startOfCombat: ['ASSAULT_CANNON', 'THE_ALASTOR'] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 5 },
        abilities: { ASSAULT_CANNON: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // AC fired first → Infantry not participating → defender AC targets Dread
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
  })

  it('destroys Alastor before it activates when Nekro is defender', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
    })

    // Attacker goes first in alternation: Assault Cannon fires
    // before Alastor, destroying the Flagship.
    // Alastor can't fire (unit destroyed), so infantry doesn't
    // participate — combat ends with no defender ships.
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.state.currentPhase.meta).toBe('COMPLETE')
    expect(t.defender.units.FLAGSHIP).toBeUndefined()
  })
})
