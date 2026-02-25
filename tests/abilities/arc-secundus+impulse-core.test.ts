import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARC_SECUNDUS + IMPULSE_CORE', () => {
  it('IC hit damages flagship via sustain, AS repairs at start of round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // IC fires at START_OF_COMBAT → destroys 1 Yin cruiser/destroyer →
    // produces 1 hit on attacker's non-fighter → flagship sustains → damaged
    // Then START_OF_COMBAT_ROUND → AS repairs → undamaged for dice roll
    t.advanceRound()

    expect(t.abilityLog('IMPULSE_CORE')).not.toHaveLength(0)
    expect(t.abilityLog('ARC_SECUNDUS')).not.toHaveLength(0)
    // Flagship should still be alive
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(false)
  })

  it('AS repairs pre-damaged flagship before IC hits (Barony attacker)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { FLAGSHIP: 1 },
        abilities: { PRE_DAMAGED: { FLAGSHIP: 1 } },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: { IMPULSE_CORE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // Attacker resolves first: AS repairs flagship → undamaged
    // Then defender: IC fires → flagship sustains → damaged but alive
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })

  it.fails(
    'IC destroys pre-damaged flagship before AS repairs (Yin attacker)',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'YIN_BROTHERHOOD',
          units: { CRUISER: 1, DESTROYER: 1 },
          abilities: { IMPULSE_CORE: true },
        },
        defender: {
          faction: 'BARONY_OF_LETNEV',
          units: { FLAGSHIP: 1 },
          abilities: { PRE_DAMAGED: { FLAGSHIP: 1 } },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'START')
      t.advanceRound()

      expect(t.abilityLog('IMPULSE_CORE')).not.toHaveLength(0)

      // Attacker resolves first: IC fires → hit on flagship →
      // flagship already damaged → can't sustain → destroyed
      // AS never fires (flagship gone)
      expect(t.defender.units.FLAGSHIP).toBeUndefined()
    },
  )
})
