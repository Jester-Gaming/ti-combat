import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON + THE_ALASTOR + VOS_HOLLOW', () => {
  it('VH triggers when Eidolon mech (ship) is destroyed, targets Alastor mech', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CARRIER: 2, MECH: 1 },
        abilities: { EIDOLON: true, VOS_HOLLOW: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Eidolon fires at START, defender MECH becomes Z-Grav (ship)
    // 1 hit destroys defender's mech → VH fires → destroys attacker's mech
    t.advanceRound({ defender: 1 })

    // VH should fire: Eidolon mech is a ship, opponent has matching mech
    expect(t.defender.units.MECH).toBeUndefined()
    expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
