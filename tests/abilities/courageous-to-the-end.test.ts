import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('COURAGEOUS_TO_THE_END', () => {
  it('splits when own ship dies — rolls 2 dice at combat value', () => {
    // Attacker has 1 cruiser (combat 7) with Courageous. Defender has 1
    // cruiser. Pick the dice outcome where attacker takes 1 hit → cruiser
    // dies → Courageous fires → rolls 2d7.
    // Expected 2d7 distribution:
    //   P(0 hits) = 0.6 * 0.6 = 0.36
    //   P(1 hit)  = 2 * 0.4 * 0.6 = 0.48
    //   P(2 hits) = 0.4 * 0.4 = 0.16
    // → 4 Cartesian branches (since rollDice doesn't merge).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { COURAGEOUS_TO_THE_END: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Advance to the ASSIGN_HITS phase, picking the branch where attacker
    // received 1 hit (defender's dice hit). Courageous fires during
    // assignHits → runDestroyAbilities → AFTER_DESTROY.
    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // Courageous rolls a single DiceGroup [7, 2] → getDiceOutcomes returns
    // 3 outcomes (0/1/2 hits) → 3 branches.
    expect(branches).toHaveLength(3)

    // Group by defender cruiser count remaining after Courageous. Opponent
    // starts with 1 cruiser; Courageous destroys 1 per hit (up to 1 since
    // only 1 cruiser to destroy).
    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[1]).toBeCloseTo(0.36) // 0 Courageous hits
    expect(byRemaining[0]).toBeCloseTo(0.64) // 1 or 2 Courageous hits
  })

  it('does not split when own ship is not destroyed', () => {
    // Attacker's cruiser survives the assign-hits phase (0 hits).
    // Courageous never fires → no split from Courageous.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { COURAGEOUS_TO_THE_END: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 0, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    expect(branches).toHaveLength(1)
    expect(branches[0].probability).toBe(1)
  })

  it('rolls at the destroyed ship combat value — destroyer (combat 9) yields 2d9 split', () => {
    // Attacker destroyer (combat 9) dies → Courageous rolls 2d9.
    // Expected 2d9 distribution:
    //   P(0 hits) = 0.8 * 0.8 = 0.64
    //   P(1 hit)  = 2 * 0.2 * 0.8 = 0.32
    //   P(2 hits) = 0.2 * 0.2 = 0.04
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: { COURAGEOUS_TO_THE_END: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // 2d9 → single DiceGroup with 3 outcomes (0/1/2 hits) → 3 branches
    expect(branches).toHaveLength(3)

    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count =
        unitsByBaseType(b.state.data.defender).DESTROYER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[1]).toBeCloseTo(0.64) // 0 Courageous hits
    expect(byRemaining[0]).toBeCloseTo(0.36) // at least 1 hit
  })

  it('does not fire when the destroyed own ship is not in ownPriority', () => {
    // Courageous configured with ownPriority = ['DESTROYER']. Attacker has
    // only a cruiser, so when the cruiser dies the destroy context contains
    // no destroyer — isCallable's ownPriority gate returns false and the
    // ability stays silent (no 2d7 split).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          COURAGEOUS_TO_THE_END: {
            isEnabled: true,
            ownPriority: ['DESTROYER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // No Courageous split. Only 1 branch continues past ASSIGN_HITS.
    expect(branches).toHaveLength(1)
    expect(branches[0].probability).toBe(1)

    // Attacker's cruiser was destroyed, defender's cruiser untouched —
    // confirming Courageous didn't fire.
    expect(
      unitsByBaseType(branches[0].state.data.attacker).CRUISER ?? [],
    ).toHaveLength(0)
    expect(
      unitsByBaseType(branches[0].state.data.defender).CRUISER,
    ).toHaveLength(1)
  })

  it('does not fire when the top-priority target is not in targetPriority', () => {
    // Courageous configured with targetPriority = ['CRUISER'] (no DESTROYER).
    // Attacker's cruiser dies → ownPriority gate passes (CRUISER matches),
    // but the only opponent ship is a destroyer. Defender's normal priority
    // resolves to DESTROYER, which is NOT in targetPriority → Courageous
    // does not fire.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          COURAGEOUS_TO_THE_END: {
            isEnabled: true,
            targetPriority: ['CRUISER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // No Courageous split.
    expect(branches).toHaveLength(1)
    expect(branches[0].probability).toBe(1)

    // Defender's destroyer still alive — Courageous never rolled.
    expect(
      unitsByBaseType(branches[0].state.data.attacker).CRUISER ?? [],
    ).toHaveLength(0)
    expect(
      unitsByBaseType(branches[0].state.data.defender).DESTROYER,
    ).toHaveLength(1)
  })

  it('re-evaluates ownPriority per round — skipped R1, fires R2 after state changes', () => {
    // Attacker: 1 cruiser + 1 carrier, Courageous with ownPriority =
    // ['CARRIER']. Default UNIT_PRIORITY sorts SHIPS by price ascending
    // (cheapest first), so the cruiser (2) is sacrificed before the
    // carrier (3). No AFB on either side.
    //
    // R1: attacker takes 1 hit → cruiser dies. ownPriority=['CARRIER']
    //     has no match in the destroy context → isCallable returns false
    //     → Courageous does not fire, `uses` stays at 1.
    // R2: only the carrier remains. Attacker takes 1 hit → carrier dies
    //     → ownPriority matches → Courageous fires (rolls 2d9 using the
    //     carrier's combat value 9).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, CARRIER: 1 },
        abilities: {
          COURAGEOUS_TO_THE_END: {
            isEnabled: true,
            ownPriority: ['CARRIER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // R1: attacker cruiser dies, Courageous does NOT fire.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.CRUISER ?? []).toHaveLength(0)
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3) // no Courageous damage
    expect(t.state.attacker.abilities.COURAGEOUS_TO_THE_END.uses).toBe(1)

    // R2: carrier dies, Courageous fires with 2d9.
    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // Courageous single DiceGroup [9, 2] → 3 outcomes (0/1/2 hits).
    expect(branches).toHaveLength(3)
    for (const b of branches) {
      expect(unitsByBaseType(b.state.data.attacker).CARRIER ?? []).toHaveLength(
        0,
      )
      expect(
        b.state.data.attacker.liveAbilities['COURAGEOUS_TO_THE_END']?.uses ??
          b.state.data.attacker.abilities['COURAGEOUS_TO_THE_END']?.uses,
      ).toBe(0)
    }

    // Defender cruiser distribution after Courageous 2d9:
    //   0 hits (P=0.64): 3 cruisers,  1 hit (P=0.32): 2,  2 hits (P=0.04): 1.
    const byDefender: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byDefender[count] = (byDefender[count] ?? 0) + b.probability
    }
    expect(byDefender[3]).toBeCloseTo(0.64)
    expect(byDefender[2]).toBeCloseTo(0.32)
    expect(byDefender[1]).toBeCloseTo(0.04)
  })

  it('re-evaluates targetPriority per round — skipped R1 (top=cruiser, unchecked), fires R2 (top=carrier, checked)', () => {
    // Attacker: 2 cruisers with Courageous, targetPriority = ['CARRIER']
    //   (CRUISER unchecked).
    // Defender: 1 carrier + 1 cruiser. UNIT_PRIORITY sorts by price
    //   ascending — CRUISER (2) is the defender's cheapest ship, so it
    //   sits at the top of the sacrifice priority. No AFB anywhere.
    //
    // R1: attacker takes 1 hit → 1 cruiser dies. Defender unchanged.
    //     Courageous isCallable: defender's top-priority target per its
    //     own UNIT_PRIORITY is CRUISER → not in targetPriority → don't
    //     fire, `uses` stays at 1.
    // R2: both sides take 1 hit. Defender's cruiser dies (cheapest)
    //     AND attacker's last cruiser dies in the same batch.
    //     Courageous: after defender's cruiser destruction, defender's
    //     top-priority is now CARRIER → in targetPriority → fires (2d7).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          COURAGEOUS_TO_THE_END: {
            isEnabled: true,
            targetPriority: ['CARRIER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    // R1: attacker loses 1 cruiser, defender untouched, Courageous NOT fired.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CARRIER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.state.attacker.abilities.COURAGEOUS_TO_THE_END.uses).toBe(1)

    // R2: both sides lose 1 ship. Defender's cruiser dies first (cheapest)
    // → defender's top-priority target becomes CARRIER (checked) →
    // Courageous fires.
    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 1 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // 3 branches from Courageous 2d7.
    expect(branches).toHaveLength(3)
    for (const b of branches) {
      expect(unitsByBaseType(b.state.data.attacker).CRUISER ?? []).toHaveLength(
        0,
      )
      expect(unitsByBaseType(b.state.data.defender).CRUISER ?? []).toHaveLength(
        0,
      )
      expect(
        b.state.data.attacker.liveAbilities['COURAGEOUS_TO_THE_END']?.uses ??
          b.state.data.attacker.abilities['COURAGEOUS_TO_THE_END']?.uses,
      ).toBe(0)
    }

    // Defender carrier distribution after Courageous 2d7 (only 1 carrier
    // to destroy, so 1+ hits collapse to "carrier dead"):
    //   0 hits (P=0.36): carrier alive.  1+ hit (P=0.64): carrier dead.
    const byCarrier: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CARRIER?.length ?? 0
      byCarrier[count] = (byCarrier[count] ?? 0) + b.probability
    }
    expect(byCarrier[1]).toBeCloseTo(0.36)
    expect(byCarrier[0]).toBeCloseTo(0.64)
  })
})
