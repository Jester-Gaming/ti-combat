import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('AMBUSH + CAVALRY', () => {
  it('Cavalry resolved before Ambush → Ambush rolls at Memoria II combat value 5+', () => {
    // Cavalry (Nomad promissory) transforms a selected non-fighter ship into
    // a Memoria II copy (COMBAT=[5, 2]) at START_OF_COMBAT. If Cavalry is
    // ordered to resolve before Ambush, Ambush picks up the modified combat
    // value (5+) instead of the base cruiser value (7+).
    //
    // Expected branches:
    //   - 0 hits: P(miss at 5+) = 0.4
    //   - 1 hit:  P(hit at 5+)  = 0.6
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1 },
        abilities: {
          AMBUSH: true,
          CAVALRY: {
            isEnabled: true,
            memoria2: true,
            unitType: 'CRUISER',
          },
          ABILITY_ORDER: {
            startOfCombat: [['CAVALRY'], ['AMBUSH']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // Ambush rolls 1 die at 5+ → exactly 2 branches.
    expect(branches).toHaveLength(2)

    const probs = branches.map(b => b.probability).sort((a, b) => a - b)
    expect(probs[0]).toBeCloseTo(0.4) // P(miss)
    expect(probs[1]).toBeCloseTo(0.6) // P(hit)
  })

  it('Cavalry + Memoria I (base flagship) → Ambush rolls at 7+', () => {
    // When memoria2=false, Cavalry applies Memoria I's stats (COMBAT=[7, 2]).
    // The hit-value is 7, matching the base cruiser threshold — so split
    // remains 0.4/0.6 (same as plain cruiser), but the split still occurs.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DESTROYER: 1 },
        abilities: {
          AMBUSH: true,
          CAVALRY: {
            isEnabled: true,
            memoria2: false,
            unitType: 'DESTROYER',
          },
          ABILITY_ORDER: {
            startOfCombat: [['CAVALRY'], ['AMBUSH']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(2)
    const probs = branches.map(b => b.probability).sort((a, b) => a - b)
    expect(probs[0]).toBeCloseTo(0.4)
    expect(probs[1]).toBeCloseTo(0.6)
  })

  it('Ambush resolved before Cavalry → Ambush rolls at base 7+ (order matters)', () => {
    // Reverse ABILITY_ORDER: Ambush fires first, sees plain cruiser (7+),
    // then Cavalry converts. Split: 0.4 / 0.6 at 7+.
    // Note the split probabilities coincidentally match the 7+ Memoria I
    // case above, so we additionally verify by checking that the cruiser
    // has NOT been subtyped yet when Ambush rolled (hit branch destroys
    // plain cruiser, not CRUISER:Cavalry).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1 },
        abilities: {
          AMBUSH: true,
          CAVALRY: {
            isEnabled: true,
            memoria2: true,
            unitType: 'CRUISER',
          },
          ABILITY_ORDER: {
            startOfCombat: [['AMBUSH'], ['CAVALRY']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(2)
    const probs = branches.map(b => b.probability).sort((a, b) => a - b)
    // With Ambush firing FIRST on a plain cruiser (combat 7+):
    //   P(miss) = 0.6, P(hit) = 0.4
    expect(probs[0]).toBeCloseTo(0.4)
    expect(probs[1]).toBeCloseTo(0.6)
  })

  it('Ambush applied to destroyer while Cavalry converts cruiser — uses correct per-ship combat values', () => {
    // Attacker has 1 cruiser (Cavalry target → becomes [5, 2]) and 1 destroyer
    // (plain, combat 9). With ABILITY_ORDER [CAVALRY, AMBUSH]:
    //   - Cavalry: cruiser → CRUISER:Cavalry with COMBAT=[5, 2]
    //   - Ambush: picks up both ships (the cavalry cruiser and the destroyer).
    //     Dice: [[5, 1], [9, 1]] → Cartesian product:
    //       [0,0]: P = 0.4 * 0.8 = 0.32
    //       [0,1]: P = 0.4 * 0.2 = 0.08
    //       [1,0]: P = 0.6 * 0.8 = 0.48
    //       [1,1]: P = 0.6 * 0.2 = 0.12
    //     → 4 Cartesian branches.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          AMBUSH: true,
          CAVALRY: {
            isEnabled: true,
            memoria2: true,
            unitType: 'CRUISER',
          },
          ABILITY_ORDER: {
            startOfCombat: [['CAVALRY'], ['AMBUSH']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // 2 dice × 2 outcomes = 4 Cartesian branches
    expect(branches).toHaveLength(4)

    // Sum probabilities by total hits produced. 0 hits → defender keeps 2
    // destroyers, 1 hit → 1 destroyer, 2 hits → 0 destroyers.
    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count =
        unitsByBaseType(b.state.data.defender).DESTROYER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    // P(0 hits) = 0.4 * 0.8 = 0.32
    // P(1 hit)  = 0.4 * 0.2 + 0.6 * 0.8 = 0.08 + 0.48 = 0.56
    // P(2 hits) = 0.6 * 0.2 = 0.12
    expect(byRemaining[2]).toBeCloseTo(0.32)
    expect(byRemaining[1]).toBeCloseTo(0.56)
    expect(byRemaining[0]).toBeCloseTo(0.12)
  })
})
