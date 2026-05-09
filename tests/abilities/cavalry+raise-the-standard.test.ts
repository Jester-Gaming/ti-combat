import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + RAISE_THE_STANDARD', () => {
  it('galvanizes the Cavalry-cruiser when the priority lists base CRUISER', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          RAISE_THE_STANDARD: {
            isEnabled: true,
            spaceUnitPriority: [['CRUISER']],
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('COMPLETE')

    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
    expect(t.defender.units.FIGHTER).toBeUndefined()

    expect(t.abilityLog('RAISE_THE_STANDARD')).not.toHaveLength(0)
    expect(
      t.attacker.units.CRUISER!.some(
        u =>
          u.subtypes?.includes('Galvanized') && u.subtypes?.includes('Cavalry'),
      ),
    ).toBe(true)
  })
})
