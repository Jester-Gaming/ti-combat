import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + SLEEPER_CELL', () => {
  it('SC copies ship destroyed by Direct Hit after sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit to defender → dreadnought sustains → Direct Hit destroys it
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    // DH destroyed dreadnought → SC copies a dreadnought for attacker
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.abilityLog('SLEEPER_CELL')).not.toHaveLength(0)
  })

  it('SC copies the Direct Hit target type not the sustain type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 4 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit → War Sun sustains → DH destroys War Sun
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    // SC copies war sun
    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
  })

  it('per tirules 7a: SC fires immediately when DH destroys a ship during sustain phase', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 5 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits to defender → first dreadnought sustains → DH destroys it → SC fires immediately
    // Second dreadnought sustains remaining hit
    t.advanceRound({ defender: 2 })

    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)

    // SC should have copied 1 dreadnought (from DH kill)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
  })
})
