import { describe, expect, it } from 'vitest'

import type { CombatSide, UnitId, UnitType } from '@/types'

import {
  foldRerolls,
  foldRerollsForSide,
  type QueuedSpec,
  type QueuedSpecForSide,
} from './fold-rerolls'
import type { GroupRoll, RerollSpec } from './types'

const u = (s: string) => s as UnitId

const fighterGroup = (units: number, hitValue: number): GroupRoll => ({
  source: 'FIGHTER' as UnitType,
  variantKey: 'FIGHTER',
  units: Array.from({ length: units }, (_, i) => u(`f${i}`)),
  dicePerUnit: 1,
  hitValue,
  hits: [],
})

const spec = (overrides: Partial<QueuedSpec> = {}): QueuedSpec => ({
  abilityKey: 'TEST',
  spec: { target: 'MISSES' } as RerollSpec,
  ...overrides,
})

const sideSpec = (
  overrides: Partial<QueuedSpecForSide> = {},
): QueuedSpecForSide => ({
  side: 'attacker' as CombatSide,
  abilityOwnerSide: 'attacker' as CombatSide,
  abilityKey: 'TEST',
  spec: { target: 'MISSES' } as RerollSpec,
  ...overrides,
})

describe('foldRerollsForSide — no specs', () => {
  it('empty queue returns single identity branch', () => {
    const groups = [fighterGroup(1, 9)]
    const branches = foldRerollsForSide(groups, [])
    expect(branches.length).toBe(1)
    expect(branches[0].probability).toBeCloseTo(1, 12)
    expect(branches[0].usesDelta).toEqual({})
    expect(branches[0].dist.cells.get('1')).toBeCloseTo(0.2, 12)
    expect(branches[0].dist.cells.get('0')).toBeCloseTo(0.8, 12)
  })
})

describe('foldRerollsForSide — single spec', () => {
  it('ALWAYS MISSES on 1F p=0.2: P_hit becomes 0.36, usesDelta=-1', () => {
    const groups = [fighterGroup(1, 9)]
    const branches = foldRerollsForSide(groups, [spec()])
    expect(branches.length).toBe(1)
    expect(branches[0].probability).toBeCloseTo(1, 12)
    expect(branches[0].usesDelta).toEqual({ TEST: -1 })
    expect(branches[0].dist.cells.get('1')).toBeCloseTo(0.36, 12)
  })

  it('rerollIf=false everywhere: identity, no uses delta', () => {
    const groups = [fighterGroup(1, 9)]
    const branches = foldRerollsForSide(groups, [
      spec({ spec: { target: 'MISSES', rerollIf: () => false } }),
    ])
    expect(branches.length).toBe(1)
    expect(branches[0].usesDelta).toEqual({})
    expect(branches[0].dist.cells.get('1')).toBeCloseTo(0.2, 12)
  })

  it('conditional rerollIf splits into 2 branches with correct weights', () => {
    const groups = [fighterGroup(2, 6)]
    const branches = foldRerollsForSide(groups, [
      spec({
        spec: { target: 'MISSES', rerollIf: side => side.total <= 1 },
      }),
    ])
    expect(branches.length).toBe(2)
    const spent = branches.find(b => b.usesDelta.TEST === -1)
    const kept = branches.find(b => Object.keys(b.usesDelta).length === 0)
    expect(spent).toBeDefined()
    expect(kept).toBeDefined()
    expect(spent!.probability).toBeCloseTo(0.75, 12)
    expect(kept!.probability).toBeCloseTo(0.25, 12)
    expect(kept!.dist.cells.get('2')).toBeCloseTo(1, 12)
  })
})

describe('foldRerollsForSide — multi-spec composition', () => {
  it('two ALWAYS MISSES on 1F p=0.2: P_hit becomes 1 - 0.8^3', () => {
    const groups = [fighterGroup(1, 9)]
    const branches = foldRerollsForSide(groups, [
      spec({ abilityKey: 'A' }),
      spec({ abilityKey: 'B' }),
    ])
    expect(branches.length).toBe(1)
    expect(branches[0].usesDelta).toEqual({ A: -1, B: -1 })
    expect(branches[0].dist.cells.get('1')).toBeCloseTo(1 - 0.8 ** 3, 12)
  })

  it('two specs from same abilityKey: single usesDelta entry', () => {
    const groups = [fighterGroup(1, 9)]
    const branches = foldRerollsForSide(groups, [
      spec({ abilityKey: 'WAR_FUNDING' }),
      spec({ abilityKey: 'WAR_FUNDING' }),
    ])
    expect(branches.length).toBe(1)
    expect(branches[0].usesDelta).toEqual({ WAR_FUNDING: -1 })
  })
})

describe('foldRerolls — cross-side', () => {
  it('attacker fold x defender fold = cartesian with merged usesDelta', () => {
    const att = [fighterGroup(1, 9)]
    const def = [fighterGroup(1, 6)]
    const result = foldRerolls(att, def, [
      sideSpec({ side: 'attacker' as CombatSide, abilityKey: 'A' }),
      sideSpec({ side: 'defender' as CombatSide, abilityKey: 'D' }),
    ])
    expect(result.length).toBe(1)
    expect(result[0].probability).toBeCloseTo(1, 12)
    expect(result[0].usesDelta).toEqual({ A: -1, D: -1 })
    expect(result[0].attackerDist.cells.get('1')).toBeCloseTo(0.36, 12)
    expect(result[0].defenderDist.cells.get('1')).toBeCloseTo(0.75, 12)
  })

  it('one ability on both sides: single usesDelta entry', () => {
    const att = [fighterGroup(1, 9)]
    const def = [fighterGroup(1, 6)]
    const result = foldRerolls(att, def, [
      sideSpec({ side: 'attacker' as CombatSide, abilityKey: 'WF' }),
      sideSpec({
        side: 'defender' as CombatSide,
        abilityKey: 'WF',
        spec: { target: 'ALL' },
      }),
    ])
    expect(result.length).toBe(1)
    expect(result[0].usesDelta).toEqual({ WF: -1 })
  })

  it('empty queue: single identity branch', () => {
    const att = [fighterGroup(1, 9)]
    const def = [fighterGroup(1, 6)]
    const result = foldRerolls(att, def, [])
    expect(result.length).toBe(1)
    expect(result[0].usesDelta).toEqual({})
  })
})
