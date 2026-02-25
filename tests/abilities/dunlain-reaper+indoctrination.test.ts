import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DUNLAIN_REAPER + INDOCTRINATION', () => {
  it('Indoctrination cannot fire when Dunlain converts the last infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { INDOCTRINATION: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    // Dunlain (attacker) fires first: converts infantry → 1 mech
    // Indoctrination (defender): no opponent infantry → doesn't fire
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('both fire when Letnev has infantry remaining after Dunlain', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    // Dunlain (attacker) fires first: 3 → 2 infantry + 1 mech
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    // Indoctrination (defender) fires second: steals 1 → 1 infantry + 1 mech
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
