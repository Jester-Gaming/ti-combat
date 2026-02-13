import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VALKYRIE_PARTICLE_WEAVE', () => {
  it('produces 1 additional hit when opponent produces hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // attacker receives 1 hit from defender dice, ability adds 1 hit to defender
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).toHaveLength(1)
    // Defender receives 1 hit from ability, so loses 1 infantry
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire when opponent produces 0 hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // attacker receives 0 hits
    t.advanceRound({ attacker: 0 })

    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).toHaveLength(0)
  })

  it('fires each round when opponent produces hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1, defender: 1 })
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).toHaveLength(2)
    // Defender loses 1 infantry per round from the ability
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
