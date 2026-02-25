import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('2RAM + BLITZ', () => {
  it.fails(
    '[engine] Blitz gives ships bombardment and 2RAM strips PS so they can fire',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'L1Z1X_MINDNET',
          units: { CRUISER: 2, INFANTRY: 1 },
          abilities: {
            TWO_RAM: true,
            BLITZ: true,
          },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 1, INFANTRY: 2 },
        },
      })

      // 2RAM strips PS at PREPARE, Blitz adds Bombardment 6 to cruisers
      t.advanceTo('COMMIT_UNITS') // past BOMBARDMENT
      const pool = t.dicePool()

      // Cruisers got Bombardment 6 from Blitz, PS stripped by 2RAM
      expect(pool.attacker).toContainDice('CRUISER', [6, 1], [6, 1])
    },
  )

  it('[engine] without 2RAM, Blitz bombardment is blocked by Planetary Shield', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, INFANTRY: 1 },
        abilities: {
          BLITZ: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('COMMIT_UNITS') // past BOMBARDMENT
    const pool = t.dicePool()

    // PS blocks bombardment, so no dice
    expect(pool?.attacker?.CRUISER).toBeUndefined()
  })
})
