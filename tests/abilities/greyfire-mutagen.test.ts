import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GREYFIRE_MUTAGEN', () => {
  it('replaces 1 opponent infantry with own infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when opponent has fewer than 2 ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when opponent has no infantry (only mechs)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(2)
  })

  it('does not fire in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { CRUISER: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
  })

  it('does not fire when opponent is Yin Brotherhood', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('fires when opponent has mix of mechs and infantry totaling 2+ ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.MECH).toHaveLength(1)
  })
})
