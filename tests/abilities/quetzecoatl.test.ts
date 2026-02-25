import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('QUETZECOATL', () => {
  it('blocks opponent PDS Space Cannon during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // PDS Space Cannon blocked by Quetzecoatl
    expect(pool.defender.PDS).toBeUndefined()
  })

  it('does not affect Space Cannon Defense (ground combat)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // Quetzecoatl has context: 'SPACE', so it does not block SCD
    // Per tirules: "A player may still use the Space Cannon ability of
    // their units against the Argent player's ground forces during the
    // Space Cannon Defense step of an invasion in this system."
    expect(pool.defender).toContainDice('PDS', [6, 1])
  })

  it('does not block own side Space Cannon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { FLAGSHIP: 1, PDS: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Quetzecoatl blocks opponent's SC, not own
    // Argent Flight's own PDS should still fire
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })
})
