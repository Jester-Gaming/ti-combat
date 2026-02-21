import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('BROTHER_MILOR', () => {
  it('places 2 fighters when own ship is destroyed in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Attacker receives 1 hit — fighter destroyed, Brother Milor places 2 fighters
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FIGHTER).toHaveLength(2) // 0 (destroyed) + 2 (placed)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
  })

  it('places 2 infantry when own ground force is destroyed in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Attacker receives 1 hit — 1 infantry destroyed, Brother Milor adds 2
    t.advanceRound({ attacker: 1 })

    // 2 - 1 (destroyed) + 2 (placed) = 3
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
  })

  it('does not fire when only opponent units are destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Defender receives 1 hit — fighter destroyed, but it's opponent's unit
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0)
  })

  it('exhausts after one use (does not fire in round 2)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 3 },
        abilities: { BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toHaveLength(4) // 2 remaining + 2 placed

    // Round 2: another fighter destroyed, but agent is exhausted
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
  })
})
