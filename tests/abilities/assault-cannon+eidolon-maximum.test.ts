import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON + EIDOLON_MAXIMUM', () => {
  it('Eidolon Maximum counts as non-fighter ship for Assault Cannon threshold', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 2, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          ASSAULT_CANNON: { isEnabled: true, targetPriority: [['CRUISER']] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    // Advance past START_OF_COMBAT where Assault Cannon fires
    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Assault Cannon fired: 1 defender cruiser destroyed
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('3v3: Assault Cannon fires first (Eidolon Maximum has no START_OF_COMBAT)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 2, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          ASSAULT_CANNON: { isEnabled: true, targetPriority: [['CRUISER']] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Assault Cannon fires at START_OF_COMBAT — 3 non-fighter ships
    // (2 cruisers + Eidolon Maximum mech). Eidolon Maximum only has
    // START_OF_COMBAT_ROUND so it doesn't compete for first ability.
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('Eidolon Maximum can be targeted by opponent Assault Cannon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: { isEnabled: true, targetPriority: [['MECH']] },
        },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, CRUISER: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Assault Cannon targets MECH (Eidolon Maximum)
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.MECH).toBeUndefined()
  })
})
