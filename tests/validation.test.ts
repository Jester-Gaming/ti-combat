import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'
import { getAllAbilities } from '@/hooks/combat-setup/get-available-abilities'
import type { SerializedConfig } from '@/hooks/combat-setup/serialization'
import {
  buildAbilityLookup,
  validateSerializedConfig,
} from '@/hooks/combat-setup/validation'

const abilityLookup = buildAbilityLookup(getAllAbilities())

function makeValidConfig(): SerializedConfig {
  const setup = new CombatSetup()
  setup.setUnitCount('attacker', 'DREADNOUGHT', 2)
  return setup.toSerializedConfig()
}

describe('validateSerializedConfig', () => {
  it('accepts a valid config with no warnings', () => {
    const config = makeValidConfig()
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings).toEqual([])
    expect(result.config).toEqual(config)
  })

  it('resets unknown faction to default', () => {
    const config = { ...makeValidConfig(), af: 'NONEXISTENT_FACTION' }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('NONEXISTENT_FACTION')
    expect(result.config.af).not.toBe('NONEXISTENT_FACTION')
  })

  it('resets invalid combat mode to default', () => {
    const config = { ...makeValidConfig(), m: 'X' as 'S' | 'G' }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.m).toBe('S')
  })

  it('ignores unknown unit types with warning', () => {
    const config = makeValidConfig()
    config.au['FAKE_UNIT'] = [3, 0]
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.au['FAKE_UNIT']).toBeUndefined()
  })

  it('clamps unit count to limits', () => {
    const config = makeValidConfig()
    config.au['FLAGSHIP'] = [5, 0]
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.config.au['FLAGSHIP']![0]).toBe(1)
  })

  it('skips ability with invalid base params', () => {
    const config = makeValidConfig()
    config.aa['DIRECT_HIT'] = {
      isEnabled: 'not_a_bool' as unknown as boolean,
      uses: 2,
    }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.aa['DIRECT_HIT']).toBeUndefined()
  })

  it('skips unknown ability keys with warning', () => {
    const config = makeValidConfig()
    config.aa['NONEXISTENT_ABILITY'] = { isEnabled: true, uses: 1 }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.config.aa['NONEXISTENT_ABILITY']).toBeUndefined()
  })

  it('keeps valid abilities alongside invalid ones', () => {
    const config = makeValidConfig()
    config.aa['DIRECT_HIT'] = { isEnabled: true, uses: 2 }
    config.aa['FAKE_ABILITY'] = { isEnabled: true, uses: 1 }
    const result = validateSerializedConfig(config, abilityLookup)
    expect(result.config.aa['DIRECT_HIT']).toBeDefined()
    expect(result.config.aa['FAKE_ABILITY']).toBeUndefined()
  })
})
