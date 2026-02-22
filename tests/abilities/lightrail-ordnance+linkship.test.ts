import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LIGHTRAIL_ORDNANCE + LINKSHIP', () => {
  it('linkship uses enhanced Space Dock SC from Lightrail Ordnance', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        abilities: {
          LIGHTRAIL_ORDNANCE: true,
          LINKSHIP: { structures: { SPACE_DOCK: 1 } },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    // Lightrail Ordnance upgrades Space Dock SC to [5, 2]
    // Linkship reads that enhanced value
    expect(pool.defender.DESTROYER).toHaveLength(1)
    expect(pool.defender).toContainDice('DESTROYER', [5, 2])
  })
})
