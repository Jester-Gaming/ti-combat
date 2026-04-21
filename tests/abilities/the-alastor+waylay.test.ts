import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('THE_ALASTOR + WAYLAY', () => {
  it('AFB hits can target ground forces participating as ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: true },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
    })

    // 2 AFB hits with Waylay -> target all ships including infantry (via Alastor)
    // Advance past AFB assignment
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { defender: 2 })

    // 2 hits: flagship sustains 1 (damaged), 1 infantry destroyed
    expect(t.defender.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.FLAGSHIP).toHaveLength(1)
    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBe(true)
  })

  it('AFB hits can damage mech sustain via Waylay + Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 3 },
        abilities: { WAYLAY: true },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
    })

    // 2 hits from AFB with Waylay -> both units sustain
    // Advance past AFB assignment
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { defender: 2 })

    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
  })
})
