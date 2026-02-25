import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + ENTROPIC_SCAR', () => {
  it('[engine] Entropic Scar disables bombardment, making Blitz-granted bombardment useless', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 1 },
        abilities: {
          BLITZ: true,
          ENTROPIC_SCAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    const pool = t.dicePool()

    // No bombardment dice (Entropic Scar disabled BOMBARDMENT)
    expect(pool?.attacker?.CRUISER).toBeUndefined()
  })
})
