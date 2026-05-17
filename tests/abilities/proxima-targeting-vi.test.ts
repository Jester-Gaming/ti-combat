import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PROXIMA_TARGETING_VI', () => {
  it('resolves a single merged bombardment (opp + self in one roll)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.dicePool(-2).hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
  })

  // NO_EXPLICIT_RULLING
  // Probably, we shouldn't interrupt ability. But I am not 100% sure
  it('both rolls assign hits together — no early termination between them', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Force both bombs to land 3 hits. With the old sequential resolution
    // the first bomb would wipe the defender and end combat before the
    // self-bomb's 3 hits killed the attacker. With deferred completion
    // both pools assign and combat ends in a draw.
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { defender: 3 })
    t.advanceToTiming('BEFORE_ASSIGN_HITS', { attacker: 3 })
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('does NOT resolve bombardment when resolveBombardment is false (default)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: { PROXIMA_TARGETING_VI: true }, // isEnabled: true, resolveBombardment: false
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    const proximaBombardments = t
      .abilityLog('PROXIMA_TARGETING_VI')
      .filter(entry => entry.path.includes('BOMBARDMENT'))
    expect(proximaBombardments).toHaveLength(0)
  })

  it('cancels 1 bombardment hit per galvanized unit (defender-side)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 1]],
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { attacker: 0, defender: 2 })

    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('galvanized structure (SPACE_DOCK) on the planet counts toward hit cancel', () => {
    // Uses SPACE_DOCK rather than PDS because PDS carries PLANETARY_SHIELD,
    // which would block bombardment entirely — we need the bomb to fire so
    // the cancel path is exercised. SPACE_DOCK is in SETTINGS.structures
    // (alongside PDS) but doesn't shield.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3, SPACE_DOCK: 1 },
        abilities: {
          PROXIMA_TARGETING_VI: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['SPACE_DOCK', 1]],
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { attacker: 0, defender: 2 })

    // 2 bomb hits − 1 cancel (galvanized SPACE_DOCK is a non-participating
    // structure on the planet) = 1 hit lands on INF
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('bombardmentMinGalvanized=1: skips bombardment when no galvanized present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
            bombardmentMinGalvanized: 1,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // No galvanized → gate fails → Proxima's START_OF_COMBAT_ROUND `call`
    // doesn't run, so no PROXIMA entry is logged.
    expect(t.abilityLog('PROXIMA_TARGETING_VI')).toHaveLength(0)
  })

  it('bombardmentMinGalvanized=1: fires bombardment when threshold met', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
            bombardmentMinGalvanized: 1,
          },
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 1]],
            reinforcementTokens: 7,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('PROXIMA_TARGETING_VI')).not.toHaveLength(0)
  })

  it('bombardmentMinGalvanized=2: 1 galvanized is below threshold → no bomb', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
            bombardmentMinGalvanized: 2,
          },
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 1]],
            reinforcementTokens: 7,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.abilityLog('PROXIMA_TARGETING_VI')).toHaveLength(0)
  })

  it('galvanized ship (DREADNOUGHT in space) does NOT count toward hit cancel', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3, DREADNOUGHT: 1 },
        abilities: {
          PROXIMA_TARGETING_VI: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['DREADNOUGHT', 1]],
            reinforcementTokens: 7,
          },
        },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { attacker: 0, defender: 2 })

    // 2 bomb hits − 0 cancels (galvanized DREADNOUGHT is a ship, not on the
    // bombarded planet) = 2 hits land
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })
})
