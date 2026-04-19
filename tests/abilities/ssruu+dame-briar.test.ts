import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SSRUU + DAME_BRIAR', () => {
  it('both Dame Briar and Ssruu-as-Dame-Briar fire once per destruction — two survivors galvanized', () => {
    // 3 cruisers on attacker (Yssaril). One dies in round 1. Dame Briar fires
    // on that destruction and galvanizes one survivor. Ssruu — copying Dame
    // Briar — fires independently on the same destruction and galvanizes a
    // different survivor. Each agent consumes its own use and its own
    // reinforcement token.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 3 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'DAME_BRIAR',
            spaceUnitType: 'CRUISER',
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // One cruiser died
    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('DAME_BRIAR')).not.toHaveLength(0)
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)

    // Two galvanized survivors — one from Dame Briar, one from Ssruu
    const galvanized = t.attacker.units.CRUISER!.filter(u =>
      u.subtypes?.includes('Galvanized'),
    )
    expect(galvanized).toHaveLength(2)

    // Each agent consumed its own use
    expect(t.state.abilities.attacker.DAME_BRIAR.uses).toBe(0)
    expect(t.state.abilities.attacker.SSRUU.uses).toBe(0)

    // Two reinforcement tokens consumed (7 → 5)
    expect(t.state.abilities.attacker.PRE_GALVANIZED.reinforcementTokens).toBe(
      5,
    )
  })

  it('only one agent fires when there is just one eligible survivor to galvanize', () => {
    // Only 2 cruisers. One dies — only one survivor remains. One agent fires
    // and galvanizes that survivor; the other agent finds no plain CRUISER
    // left to galvanize (the one unit is now CRUISER:Galvanized) and does
    // not fire. Total: 1 galvanized, 1 use consumed across both agents.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
          SSRUU: {
            isEnabled: true,
            agentKey: 'DAME_BRIAR',
            spaceUnitType: 'CRUISER',
          },
          PRE_GALVANIZED: { reinforcementTokens: 7 },
        },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // One cruiser died, one survives
    expect(t.attacker.units.CRUISER).toHaveLength(1)

    // Exactly one galvanized survivor (not re-galvanized by the second agent)
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Galvanized')

    // Only one use consumed across both agents (total remaining = 1)
    const dameUses = (t.state.abilities.attacker.DAME_BRIAR.uses as number) ?? 1
    const ssruuUses = (t.state.abilities.attacker.SSRUU.uses as number) ?? 1
    expect(dameUses + ssruuUses).toBe(1)

    // Only one reinforcement token consumed (7 → 6)
    expect(t.state.abilities.attacker.PRE_GALVANIZED.reinforcementTokens).toBe(
      6,
    )
  })
})
