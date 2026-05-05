import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DIRECT_HIT + EIDOLON_MAXIMUM', () => {
  it('Direct Hit destroys Eidolon Maximum after it uses Sustain Damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, CRUISER: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { spacePriority: ['MECH'] },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Direct Hit fires after sustain: mech destroyed
    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    expect(t.defender.units.MECH).toBeUndefined()
    // Cruiser survives
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  // NO_EXPLICIT_RULLING
  // To be honest, I have no idea how it should work.
  // RAW it should, but it feels so strange
  it("Direct Hit doesn't work on EM in ground combat (EM is always a ship)", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { groundPriority: ['MECH'] },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    // Direct Hit fires after sustain: mech destroyed in ground combat
    expect(t.abilityLog('DIRECT_HIT')).toHaveLength(0)
    expect(t.defender.units.MECH).not.toBeUndefined()
  })
})
