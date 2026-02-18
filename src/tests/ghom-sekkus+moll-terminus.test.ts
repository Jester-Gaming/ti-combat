import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('GHOM_SEKKUS + MOLL_TERMINUS', () => {
  it('committed mechs cannot sustain against Mentak defender', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GHOM_SEKKUS: { isEnabled: true, units: { MECH: 1 } } },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')

    expect(t.attacker.units.MECH).toHaveLength(1)

    // Attacker receives 1 hit — mech can't sustain, so infantry takes the hit
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it("Mentak mech committed via G'hom Sek'kus disables opponent sustain", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { INFANTRY: 2 },
        abilities: { GHOM_SEKKUS: { isEnabled: true, units: { MECH: 1 } } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')

    expect(t.attacker.units.MECH).toHaveLength(1)

    // Defender receives 1 hit — mech can't sustain due to Moll Terminus, infantry destroyed
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH![0].isDamaged).toBeFalsy()
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
