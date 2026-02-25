import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DUNLAIN_REAPER + ENTROPIC_SCAR', () => {
  it('deploy still fires because Dunlain Reaper is a config ability (not a unit ability)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          ENTROPIC_SCAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    // Dunlain Reaper is a config ability, not a unit ability, so Entropic Scar
    // should not prevent it from firing
    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('deployed mech cannot use Sustain Damage in Entropic Scar', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 1 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          ENTROPIC_SCAR: true,
          SUSTAIN_DAMAGE: { groundPriority: ['MECH'] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Deploy replaces infantry with mech; attacker has 1 mech
    // 1 hit on attacker → mech can't sustain in Entropic Scar → destroyed
    t.advanceRound({ attacker: 1 })

    // Mech should be destroyed (no sustain)
    expect(t.attacker.units.MECH).toBeUndefined()
  })

  it.fails('Entropic Scar disables Letnev mech ability', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 3 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          ENTROPIC_SCAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { ENTROPIC_SCAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound(0)

    // Dunlain Reaper should not convert infantry to mech
    expect(t.abilityLog('DUNLAIN_REAPER')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
