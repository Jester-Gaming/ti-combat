import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CLAIRE_GIBSON + INDOCTRINATION', () => {
  it('works alongside Claire Gibson at start of ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { CLAIRE_GIBSON: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Claire Gibson adds 1 infantry to defender
    expect(t.abilityLog('CLAIRE_GIBSON')).not.toHaveLength(0)
    // Indoctrination removes 1 opponent infantry and adds 1 to attacker
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)

    // Attacker: 2 + 1 (indoctrination) = 3
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    // Defender: 3 + 1 (Claire Gibson) - 1 (indoctrination) = 3
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it('Claire Gibson does not trigger when Indoctrination removes last unit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: { CLAIRE_GIBSON: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Indoctrination removes defender's only infantry → combat ends
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('CLAIRE_GIBSON')).toHaveLength(0)
  })
})
