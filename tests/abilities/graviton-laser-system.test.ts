import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GRAVITON_LASER_SYSTEM', () => {
  it.forEachSide('restricts SCO targets to non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { GRAVITON_LASER_SYSTEM: true },
      },
    })

    t.advanceTo('AFB', undefined, { attacker: 1 })

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it.fails('targets fighter when no non-fighter ships present', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { GRAVITON_LASER_SYSTEM: true },
      },
    })

    // Only fighters present — GLS should fall back to targeting a fighter
    t.advanceTo('AFB', undefined, { attacker: 1 })

    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('does not affect SCD targets', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { GRAVITON_LASER_SYSTEM: true },
      },
    })

    // SCD hits attacker; GLS only affects SCO, not SCD
    t.advanceTo('GROUND_COMBAT', undefined, { attacker: 1 })

    // Infantry can be targeted by SCD (GLS doesn't restrict SCD)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
