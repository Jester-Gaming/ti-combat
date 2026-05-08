import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('AMBUSH + ASSAULT_CANNON', () => {
  it('AC fires independently in each Ambush branch', () => {
    // Attacker (Mentak): 3 destroyers (satisfies AC's 3-non-fighter-ships
    // requirement). Ambush + AC both enabled; ABILITY_ORDER puts Ambush first.
    // With 3 destroyers, Ambush rolls dice for 2 of them (MAX_SHIPS=2), each
    // at combat 9+: per-group outcomes [0,0], [0,1], [1,0], [1,1].
    //   P([0,0]) = 0.64
    //   P([0,1]) = P([1,0]) = 0.16 each
    //   P([1,1]) = 0.04
    //
    // AC fires after Ambush in EACH branch independently. It destroys 1
    // opponent cruiser via targetPriority. So the final defender cruiser
    // count per branch = 4 (initial) - (Ambush hits) - 1 (AC).
    //
    //   [0,0] → 4 - 0 - 1 = 3 cruisers remaining
    //   [0,1] or [1,0] → 4 - 1 - 1 = 2 cruisers remaining
    //   [1,1] → 4 - 2 - 1 = 1 cruiser remaining
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DESTROYER: 3 },
        abilities: {
          AMBUSH: true,
          ASSAULT_CANNON: {
            isEnabled: true,
            targetPriority: [['CRUISER']],
          },
          ABILITY_ORDER: {
            startOfCombat: [['AMBUSH'], ['ASSAULT_CANNON']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 4 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // 4 Cartesian Ambush branches (2 dice × 2 outcomes each).
    expect(branches).toHaveLength(4)

    // Sum probabilities by defender cruiser count — this verifies AC fired
    // in every branch (otherwise some would still have 4 cruisers).
    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[3]).toBeCloseTo(0.64) // [0,0]
    expect(byRemaining[2]).toBeCloseTo(0.32) // [0,1] + [1,0]
    expect(byRemaining[1]).toBeCloseTo(0.04) // [1,1]

    // Also confirm no branch has 4 cruisers (AC should always fire).
    expect(byRemaining[4]).toBeUndefined()
  })

  it('opponent AC condition is evaluated per Ambush branch (fires only where threshold still met)', () => {
    // Attacker (Mentak): 1 cruiser with Ambush. Attacker has NO non-fighter
    // threshold relevance — only Ambush is on attacker.
    // Defender (Arborec): 3 destroyers with Assault Cannon. AC requires 3+
    // own non-fighter ships.
    //
    // Expected:
    //   - Ambush miss (P=0.6): defender still has 3 destroyers → AC fires,
    //     destroys attacker's cruiser (attacker=0 cruisers).
    //   - Ambush hit  (P=0.4): defender destroyer destroyed → 2 destroyers
    //     → AC's threshold fails → AC skips → attacker cruiser survives.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1 },
        abilities: { AMBUSH: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 3 },
        abilities: {
          ASSAULT_CANNON: {
            isEnabled: true,
            targetPriority: [['CRUISER']],
          },
        },
      },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // 2 branches from Ambush (1 die at 7+).
    expect(branches).toHaveLength(2)

    const missBranch = branches.find(b => b.probability > 0.5)!
    const hitBranch = branches.find(b => b.probability < 0.5)!

    // Miss branch: AC fired and destroyed the attacker's cruiser.
    expect(missBranch.probability).toBeCloseTo(0.6)
    expect(
      unitsByBaseType(missBranch.state.data.attacker).CRUISER ?? [],
    ).toHaveLength(0)
    expect(
      unitsByBaseType(missBranch.state.data.defender).DESTROYER,
    ).toHaveLength(3)

    // Hit branch: Ambush killed a defender destroyer, AC threshold fails,
    // attacker's cruiser survives.
    expect(hitBranch.probability).toBeCloseTo(0.4)
    expect(unitsByBaseType(hitBranch.state.data.attacker).CRUISER).toHaveLength(
      1,
    )
    expect(
      unitsByBaseType(hitBranch.state.data.defender).DESTROYER,
    ).toHaveLength(2)
  })

  it('ABILITY_ORDER reversed: AC fires first, destroys 1 cruiser, then Ambush branches', () => {
    // With ABILITY_ORDER=[ASSAULT_CANNON, AMBUSH], AC fires first (destroys
    // 1 opponent cruiser deterministically), then Ambush branches on the
    // remaining opponent fleet.
    //   Pre-Ambush: defender has 3 cruisers.
    //   Ambush branches (2 dice at 9+): same 4 outcomes.
    //   Final defender cruiser counts:
    //     [0,0] → 3 - 0 = 3
    //     [0,1]/[1,0] → 3 - 1 = 2
    //     [1,1] → 3 - 2 = 1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DESTROYER: 3 },
        abilities: {
          AMBUSH: true,
          ASSAULT_CANNON: {
            isEnabled: true,
            targetPriority: [['CRUISER']],
          },
          ABILITY_ORDER: {
            startOfCombat: [['ASSAULT_CANNON'], ['AMBUSH']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 4 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(4)
    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[3]).toBeCloseTo(0.64)
    expect(byRemaining[2]).toBeCloseTo(0.32)
    expect(byRemaining[1]).toBeCloseTo(0.04)
    expect(byRemaining[4]).toBeUndefined()
  })
})
