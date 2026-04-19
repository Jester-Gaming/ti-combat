import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('APOLLO + DAME_BRIAR', () => {
  it('Hero stamped immediately when Dame Briar galvanizes mid-combat', () => {
    // No pre-galvanized. Attacker has 2 cruisers; Dame Briar enabled. When
    // one cruiser dies, Dame Briar galvanizes the survivor mid-WHEN_DESTROY;
    // galvanizeUnit emits WHEN_GALVANIZE which stamps Hero immediately.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'LAST_BASTION',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
          APOLLO: { isEnabled: true, heroUnit: 'CRUISER:Galvanized' },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Verify the destruction happened
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)

    // Dame Briar galvanized the survivor; Apollo stamped Hero in the same
    // galvanize call (via WHEN_GALVANIZE trigger).
    const survivor = t.attacker.units.CRUISER![0]
    expect(survivor.subtypes).toContain('Galvanized')
    expect(survivor.subtypes).toContain('Hero')
  })
})
