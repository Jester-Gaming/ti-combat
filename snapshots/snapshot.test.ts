import { CombatEngine } from '@/combat'
import {
  buildCombatState,
  type CombatStateConfig,
} from '@/hooks/combat-setup/build-combat-state'

function runScenario(config: CombatStateConfig) {
  const state = buildCombatState(config)
  const engine = new CombatEngine()
  return engine.simulate(state)
}

// ---------------------------------------------------------------------------
// SPACE COMBAT SCENARIOS
// ---------------------------------------------------------------------------

describe('space combat snapshots', () => {
  it('1 cruiser vs 1 cruiser', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
        defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      }),
    ).toMatchSnapshot()
  })

  it('3 cruisers vs 3 cruisers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      }),
    ).toMatchSnapshot()
  })

  it('2 destroyers vs 2 destroyers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
        defender: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
      }),
    ).toMatchSnapshot()
  })

  it('1 dreadnought vs 1 dreadnought', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
        defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
      }),
    ).toMatchSnapshot()
  })

  it('2 dreadnoughts vs 2 dreadnoughts', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
        defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 2 } },
      }),
    ).toMatchSnapshot()
  })

  it('1 war sun vs 1 war sun', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { WAR_SUN: 1 } },
        defender: { faction: 'ARBOREC', units: { WAR_SUN: 1 } },
      }),
    ).toMatchSnapshot()
  })

  it('1 carrier + 4 fighters vs 1 carrier + 4 fighters', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CARRIER: 1, FIGHTER: 4 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CARRIER: 1, FIGHTER: 4 },
        },
      }),
    ).toMatchSnapshot()
  })

  it('5 fighters vs 5 fighters', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { FIGHTER: 5 } },
        defender: { faction: 'ARBOREC', units: { FIGHTER: 5 } },
      }),
    ).toMatchSnapshot()
  })

  // Asymmetric scenarios
  it('1 dreadnought vs 3 cruisers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      }),
    ).toMatchSnapshot()
  })

  it('1 war sun vs 3 cruisers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { WAR_SUN: 1 } },
        defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      }),
    ).toMatchSnapshot()
  })

  it('2 destroyers vs 1 carrier + 4 fighters', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
        defender: {
          faction: 'ARBOREC',
          units: { CARRIER: 1, FIGHTER: 4 },
        },
      }),
    ).toMatchSnapshot()
  })

  it('1 dreadnought + 2 cruisers vs 1 dreadnought + 2 cruisers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, CRUISER: 2 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, CRUISER: 2 },
        },
      }),
    ).toMatchSnapshot()
  })

  // Mixed fleet scenarios
  it('1 war sun + 2 dreadnoughts + 2 cruisers vs 2 dreadnoughts + 4 cruisers', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { WAR_SUN: 1, DREADNOUGHT: 2, CRUISER: 2 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 2, CRUISER: 4 },
        },
      }),
    ).toMatchSnapshot()
  })

  it('2 carriers + 2 destroyers + 6 fighters vs 2 carriers + 2 destroyers + 6 fighters', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CARRIER: 2, DESTROYER: 2, FIGHTER: 6 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CARRIER: 2, DESTROYER: 2, FIGHTER: 6 },
        },
      }),
    ).toMatchSnapshot()
  })

  it('1 war sun + 1 dreadnought vs 2 carriers + 8 fighters', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { WAR_SUN: 1, DREADNOUGHT: 1 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CARRIER: 2, FIGHTER: 8 },
        },
      }),
    ).toMatchSnapshot()
  })

  // Large fleet
  it('3 dreadnoughts + 3 cruisers + 3 destroyers + 1 carrier + 4 fighters vs same', () => {
    expect(
      runScenario({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: {
            DREADNOUGHT: 3,
            CRUISER: 3,
            DESTROYER: 3,
            CARRIER: 1,
            FIGHTER: 4,
          },
        },
        defender: {
          faction: 'ARBOREC',
          units: {
            DREADNOUGHT: 3,
            CRUISER: 3,
            DESTROYER: 3,
            CARRIER: 1,
            FIGHTER: 4,
          },
        },
      }),
    ).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// GROUND COMBAT SCENARIOS
// ---------------------------------------------------------------------------

describe('ground combat snapshots', () => {
  it('3 infantry vs 3 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
        defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
      }),
    ).toMatchSnapshot()
  })

  it('5 infantry vs 5 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: { faction: 'ARBOREC', units: { INFANTRY: 5 } },
        defender: { faction: 'ARBOREC', units: { INFANTRY: 5 } },
      }),
    ).toMatchSnapshot()
  })

  it('3 infantry vs 5 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
        defender: { faction: 'ARBOREC', units: { INFANTRY: 5 } },
      }),
    ).toMatchSnapshot()
  })

  // Bombardment scenarios
  it('1 dreadnought bombarding + 3 infantry vs 3 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 1, INFANTRY: 3 },
        },
        defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
      }),
    ).toMatchSnapshot()
  })

  it('1 war sun bombarding + 3 infantry vs 3 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { WAR_SUN: 1, INFANTRY: 3 },
        },
        defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
      }),
    ).toMatchSnapshot()
  })

  // Space cannon defense
  it('5 infantry vs 2 PDS + 3 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: { faction: 'ARBOREC', units: { INFANTRY: 5 } },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 2, INFANTRY: 3 },
        },
      }),
    ).toMatchSnapshot()
  })

  // Combined ground: bombardment vs PDS
  it('2 dreadnoughts + 5 infantry vs 2 PDS + 5 infantry', () => {
    expect(
      runScenario({
        mode: 'GROUND',
        attacker: {
          faction: 'ARBOREC',
          units: { DREADNOUGHT: 2, INFANTRY: 5 },
        },
        defender: {
          faction: 'ARBOREC',
          units: { PDS: 2, INFANTRY: 5 },
        },
      }),
    ).toMatchSnapshot()
  })
})
