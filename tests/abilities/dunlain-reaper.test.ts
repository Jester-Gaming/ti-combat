import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DUNLAIN_REAPER', () => {
  it('replaces infantry with mech at start of combat round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
  })

  it('fires each round while uses remain', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: { DUNLAIN_REAPER: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
  })

  it('does not fire when no infantry present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
  })

  it('does not fire when mech limit (4) is reached', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 4, INFANTRY: 2 },
        abilities: { DUNLAIN_REAPER: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.MECH).toHaveLength(4)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
  })
})
