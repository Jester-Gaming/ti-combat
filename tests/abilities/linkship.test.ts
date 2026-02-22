import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('LINKSHIP', () => {
  describe('Linkship I (base)', () => {
    it('adds SC dice for each linkship up to structures count', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: {
          faction: 'RAL_NEL',
          units: { DESTROYER: 2 },
          abilities: { LINKSHIP: { structures: { PDS: 2 } } },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()!

      // 2 linkships, 2 PDS structures → 2 DESTROYER SC dice groups [6, 1]
      expect(pool.defender.DESTROYER).toHaveLength(2)
      expect(pool.defender).toContainDice('DESTROYER', [6, 1])
    })

    it('is capped by structures count', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: {
          faction: 'RAL_NEL',
          units: { DESTROYER: 3 },
          abilities: { LINKSHIP: { structures: { PDS: 1 } } },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()!

      // 3 linkships but only 1 PDS structure → 1 SC dice group
      expect(pool.defender.DESTROYER).toHaveLength(1)
    })

    it('is capped by linkship count', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: {
          faction: 'RAL_NEL',
          units: { DESTROYER: 1 },
          abilities: { LINKSHIP: { structures: { PDS: 3 } } },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()!

      // 1 linkship, 3 PDS structures → 1 SC dice group
      expect(pool.defender.DESTROYER).toHaveLength(1)
    })

    it('uses best SC source first then falls back', () => {
      // Space Dock SC [5, 2] (via Lightrail Ordnance) is better than PDS [6, 1]
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: {
          faction: 'RAL_NEL',
          units: { DESTROYER: 2, SPACE_DOCK: 1 },
          abilities: {
            LINKSHIP: { structures: { PDS: 1, SPACE_DOCK: 1 } },
            LIGHTRAIL_ORDNANCE: true,
          },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()!

      // 2 linkships: first uses Space Dock [5, 2], second uses PDS [6, 1]
      expect(pool.defender.DESTROYER).toHaveLength(2)
      expect(pool.defender).toContainDice('DESTROYER', [5, 2])
      expect(pool.defender).toContainDice('DESTROYER', [6, 1])
    })
  })

  describe('Linkship II (upgraded)', () => {
    it('allows all linkships to fire using the same structure', () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: {
          faction: 'RAL_NEL',
          units: { DESTROYER: 3 },
          upgrades: ['DESTROYER'],
          abilities: { LINKSHIP: { structures: { PDS: 1 } } },
        },
      })

      t.advanceTo('SPACE_COMBAT')
      const pool = t.dicePool()!

      // Linkship II: all 3 destroyers fire SC using the 1 PDS
      expect(pool.defender.DESTROYER).toHaveLength(3)
      expect(pool.defender).toContainDice('DESTROYER', [6, 1])
    })
  })

  it('works without structures in the units list', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1 },
        abilities: { LINKSHIP: { structures: { PDS: 1 } } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    // No PDS in units list, but SC value derived from faction config
    expect(pool.defender.DESTROYER).toHaveLength(1)
    expect(pool.defender).toContainDice('DESTROYER', [6, 1])
  })

  it('does not fire when no structures configured', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender.DESTROYER).toBeUndefined()
  })

  it('uses best SC source among structures', () => {
    // Lightrail Ordnance gives Space Dock SC [5, 2] — better than PDS [6, 1]
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1, SPACE_DOCK: 1 },
        abilities: {
          LINKSHIP: { structures: { SPACE_DOCK: 1 } },
          LIGHTRAIL_ORDNANCE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    // Linkship uses Space Dock's SC [5, 2] (better than PDS [6, 1])
    expect(pool.defender).toContainDice('DESTROYER', [5, 2])
  })
})
