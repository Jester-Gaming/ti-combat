import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LIGHTRAIL_ORDNANCE + LINKSHIP_1', () => {
  it('linkship uses enhanced Space Dock SC from Lightrail Ordnance', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        abilities: {
          LIGHTRAIL_ORDNANCE: true,
          LINKSHIP_1: { structures: [['SPACE_DOCK', 1]] },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Lightrail Ordnance upgrades Space Dock SC to [5, 2]
    // Linkship reads that enhanced value
    expect(pool.defender.LINKSHIP_1).toHaveLength(1)
    expect(pool.defender).toContainDice('LINKSHIP_1', [5, 2])
  })
})
