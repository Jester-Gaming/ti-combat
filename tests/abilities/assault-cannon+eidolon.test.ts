import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON + EIDOLON', () => {
  it('Z-Grav Eidolon counts toward 3 non-fighter ships requirement', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 2, MECH: 1 },
        abilities: { ASSAULT_CANNON: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // AC fires: 3 non-fighter ships
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('3v3: both Eidolon and AC fire at START_OF_COMBAT', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 2, MECH: 1 },
        abilities: {
          ASSAULT_CANNON: { isEnabled: true, targetPriority: [['CRUISER']] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Both fire at START_OF_COMBAT (unlike Eidolon Maximum which is
    // START_OF_COMBAT_ROUND)
    expect(t.abilityLog('EIDOLON')).not.toHaveLength(0)
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('AC cannot target mech when Eidolon not resolved yet (attacker first)', () => {
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
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Attacker resolves first: AC fires but Eidolon hasn't transformed
    // MECH on defender side → MECH is not a valid ship target
    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('AC targets Z-Grav mech after Eidolon resolves (defender AC)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: { isEnabled: true, targetPriority: [['MECH']] },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    // Attacker resolves first: Eidolon fires → MECH becomes ship
    // Defender resolves second: AC fires → MECH is valid target → destroyed
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
