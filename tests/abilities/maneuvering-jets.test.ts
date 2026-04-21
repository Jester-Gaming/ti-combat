import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MANEUVERING_JETS', () => {
  it('cancels 1 hit from space cannon offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { MANEUVERING_JETS: { uses: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, CRUISER: 1 } },
    })

    // SCO: 2 PDS hits, Maneuvering Jets cancels 1 → 1 cruiser destroyed
    t.advanceTo('SPACE_COMBAT', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('cancels 1 hit from space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { MANEUVERING_JETS: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, INFANTRY: 1 },
      },
    })

    // SCD: 2 PDS hits, attacker's Maneuvering Jets cancels 1 → 1 infantry destroyed
    t.advanceTo('GROUND_COMBAT', { attacker: 2 })

    expect(t.abilityLog('MANEUVERING_JETS')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
