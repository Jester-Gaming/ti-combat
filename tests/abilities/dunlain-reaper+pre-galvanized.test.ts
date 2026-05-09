import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DUNLAIN_REAPER + PRE_GALVANIZED', () => {
  it('upgrades a Galvanized infantry to a MECH', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 1]],
          },
          DUNLAIN_REAPER: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('does not fire when MECH cap is full of Galvanized mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1, MECH: 4 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 4]],
          },
          DUNLAIN_REAPER: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(4)
  })
})
