import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('RAID_FORMATION', () => {
  it('damages ships with sustain for excess AFB hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 2 },
      },
    })

    // 3 destroyers with AFB 9x2 each = 6 dice total
    // Pick branch with 3 hits: 3 hits - 1 fighter = 2 excess
    t.advanceTo('AFB', 'ASSIGN_HITS', 3)

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })

  it('does not damage ships without sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    // 3 destroyers, no fighters on defender side
    // Pick branch with 3 hits: 3 excess but no sustain targets
    t.advanceTo('AFB', 'ASSIGN_HITS', 3)

    expect(t.defender.units.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER![0].isDamaged).toBeFalsy()
    expect(t.defender.units.CRUISER![1].isDamaged).toBeFalsy()
    expect(t.defender.units.CRUISER![2].isDamaged).toBeFalsy()
  })

  it('??? does not damage ships with lost sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
        abilities: { PUBLICIZE_WEAPON_SCHEMATICS: true },
      },
    })

    // 3 destroyers, no fighters, 3 excess hits
    // War sun has lost sustain via Publicize Weapon Schematics
    t.advanceTo('AFB', 'ASSIGN_HITS', 3)

    expect(t.defender.units.WAR_SUN![0].isDamaged).toBeFalsy()
  })
})
