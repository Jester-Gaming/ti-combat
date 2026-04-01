import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'

describe('toSerializedConfig', () => {
  it('returns version 1', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(config.v).toBe(1)
  })

  it('serializes default factions', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(typeof config.af).toBe('string')
    expect(typeof config.df).toBe('string')
    expect(config.m).toBe('S')
  })

  it('serializes units with count > 0 only', () => {
    const setup = new CombatSetup()
    setup.setUnitCount('attacker', 'DREADNOUGHT', 3)
    setup.setUpgraded('attacker', 'DREADNOUGHT', true)
    const config = setup.toSerializedConfig()
    expect(config.au).toEqual({ DREADNOUGHT: [3, 1] })
    expect(config.du).toEqual({})
  })

  it('omits abilities at default values', () => {
    const setup = new CombatSetup()
    const config = setup.toSerializedConfig()
    expect(typeof config.aa).toBe('object')
    expect(typeof config.da).toBe('object')
  })

  it('includes abilities with changed params', () => {
    const setup = new CombatSetup()
    setup.setAbilityParam('attacker', 'DIRECT_HIT', {
      isEnabled: true,
      uses: 2,
    })
    const config = setup.toSerializedConfig()
    expect(config.aa['DIRECT_HIT']).toBeDefined()
    expect(config.aa['DIRECT_HIT'].uses).toBe(2)
  })

  it('uses S/G for combat mode', () => {
    const setup = new CombatSetup()
    expect(setup.toSerializedConfig().m).toBe('S')
    setup.setCombatMode('GROUND')
    expect(setup.toSerializedConfig().m).toBe('G')
  })
})

describe('loadConfig', () => {
  it('roundtrips through serialize/load', () => {
    const original = new CombatSetup()
    original.setFaction('attacker', 'ARGENT_FLIGHT')
    original.setFaction('defender', 'ARBOREC')
    original.setUnitCount('attacker', 'DREADNOUGHT', 3)
    original.setUpgraded('attacker', 'DREADNOUGHT', true)
    original.setUnitCount('defender', 'FIGHTER', 5)
    original.setCombatMode('GROUND')

    const serialized = original.toSerializedConfig()

    const restored = new CombatSetup()
    restored.loadConfig(serialized)

    expect(restored.attackerFaction).toBe('ARGENT_FLIGHT')
    expect(restored.defenderFaction).toBe('ARBOREC')
    expect(restored.combatMode).toBe('GROUND')
    expect(restored.attackerSelections['DREADNOUGHT']).toEqual({
      count: 3,
      upgraded: true,
    })
    expect(restored.defenderSelections['FIGHTER']).toEqual({
      count: 5,
      upgraded: false,
    })
  })

  it('preserves non-default ability params through roundtrip', () => {
    const original = new CombatSetup()
    original.setAbilityParam('attacker', 'DIRECT_HIT', {
      isEnabled: true,
      uses: 3,
    })

    const serialized = original.toSerializedConfig()
    const restored = new CombatSetup()
    restored.loadConfig(serialized)

    expect(restored.abilities.attacker['DIRECT_HIT']?.uses).toBe(3)
  })

  it('resets to default for absent abilities', () => {
    const setup = new CombatSetup()
    const config: SerializedConfig = {
      v: 1,
      af: setup.attackerFaction,
      df: setup.defenderFaction,
      m: 'S',
      au: {},
      du: {},
      aa: {},
      da: {},
    }
    setup.loadConfig(config)

    // General abilities should still be initialized
    expect(setup.abilities.attacker['UNIT_PRIORITY']).toBeDefined()
  })
})
