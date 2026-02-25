import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('BROTHER_MILOR', () => {
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

  it.fails(
    'does not fire when ship destroyed during space cannon offense',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 1, FIGHTER: 1 },
          abilities: { BROTHER_MILOR: { isEnabled: true, uses: 1 } },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 1, PDS: 1 },
        },
      })

      // SCO: 1 hit on attacker → fighter destroyed
      t.advanceTo('SPACE_COMBAT', 'START', { attacker: 1 })
      expect(t.attacker.units.FIGHTER).toBeUndefined()

      // Brother Milor should NOT trigger for SCO destruction
      expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0)
    },
  )

  it.fails(
    'does not fire when ground force destroyed during bombardment',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { INFANTRY: 2 },
          abilities: { BROTHER_MILOR: { isEnabled: true, uses: 1 } },
        },
      })

      // Bombardment: 1 hit → 1 infantry destroyed
      t.advanceTo('SPACE_CANNON_DEFENSE', undefined, { defender: 1 })
      expect(t.defender.units.INFANTRY).toHaveLength(1)

      // Brother Milor should NOT trigger for bombardment destruction
      expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0)
    },
  )

  it.fails(
    'does not fire when ground force destroyed during space cannon defense',
    () => {
      const t = combatTest({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { INFANTRY: 2 },
          abilities: { BROTHER_MILOR: { isEnabled: true, uses: 1 } },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 1, INFANTRY: 1 },
        },
      })

      // SCD: 1 hit on attacker → 1 infantry destroyed
      t.advanceTo('GROUND_COMBAT', 'START', { attacker: 1 })
      expect(t.attacker.units.INFANTRY).toHaveLength(1)

      // Brother Milor should NOT trigger for SCD destruction
      expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0)
    },
  )

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
})
