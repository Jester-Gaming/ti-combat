import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID', () => {
  it('produces 1 hit against opponent ground forces when PDS is present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID').length).toBeGreaterThan(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('produces 1 hit when SPACE_DOCK is present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { SPACE_DOCK: 1, INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID').length).toBeGreaterThan(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire without structures', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
  })

  it('does not fire in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).toHaveLength(0)
  })

  it('can hit a mech with sustain damage', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID').length).toBeGreaterThan(0)
    // Mech sustains the hit
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })

  it('only fires for the defender', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })
})
