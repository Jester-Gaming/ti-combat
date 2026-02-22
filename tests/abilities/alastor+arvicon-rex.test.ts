import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALASTOR + ARVICON_REX', () => {
  it('applies -2 hit value to Nekro flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
        abilities: { ARVICON_REX: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Arvicon Rex: -2 to flagship unit only (ctx.getUnit())
    // Alastor: 9 - 2 = 7
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
    // Infantry via Alastor: unaffected
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
