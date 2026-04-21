import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DUNLAIN_REAPER + GREYFIRE_MUTAGEN', () => {
  it('both fire in same timing group: Dunlain (attacker) then Greyfire (defender)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 2 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    // Dunlain (attacker) fires first: 2 → 1 infantry + 1 mech
    // Greyfire (defender) fires second: steals 1 infantry → 0 infantry + 1 mech
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('Greyfire cannot fire when Dunlain converts the last infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1, MECH: 1 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Dunlain (attacker) fires first: converts last infantry → 2 mechs
    // Greyfire (defender): no infantry to steal → doesn't fire
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(2)
  })
})
