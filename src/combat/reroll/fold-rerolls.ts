import type { CombatSide } from '@/types'

import {
  applyAllReroll,
  applyHitsReroll,
  applyMissesReroll,
  buildInitialJoint,
  decodeKey,
  type GroupShape,
  type JointDist,
} from './distribution'
import type { GroupRoll, HitsDist, RerollSide, RerollSpec } from './types'

export interface QueuedSpec {
  abilityKey: string
  spec: RerollSpec
}

export interface QueuedSpecForSide extends QueuedSpec {
  side: CombatSide
  abilityOwnerSide: CombatSide
}

export interface SideBranch {
  dist: JointDist
  probability: number
  usesDelta: Record<string, -1>
}

export interface JointBranch {
  attackerDist: JointDist
  defenderDist: JointDist
  probability: number
  usesDelta: Record<string, -1>
}

interface LabeledDist {
  groupCount: number
  cells: Map<string, Map<number, number>>
}

const groupShape = (g: GroupRoll): GroupShape => {
  const raw = (11 - g.hitValue) / 10
  const p = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return { N: g.units.length * g.dicePerUnit, p }
}

const marginalJoint = (labeled: LabeledDist): JointDist => {
  const cells = new Map<string, number>()
  for (const [key, byLabel] of labeled.cells) {
    let sum = 0
    for (const v of byLabel.values()) sum += v
    if (sum > 0) cells.set(key, sum)
  }
  return { groupCount: labeled.groupCount, cells }
}

const marginalTotalDist = (joint: JointDist): HitsDist => {
  const m = new Map<number, number>()
  for (const [k, v] of joint.cells) {
    const total = decodeKey(k).reduce((a, b) => a + b, 0)
    m.set(total, (m.get(total) ?? 0) + v)
  }
  return Array.from(m, ([hits, probability]) => ({ hits, probability }))
}

const buildSideSnapshot = (
  groups: GroupRoll[],
  cellHits: number[],
  distribution: HitsDist,
): RerollSide => {
  const snapshotGroups = groups.map((g, i) => ({ ...g, hits: [cellHits[i]] }))
  const total = cellHits.reduce((a, b) => a + b, 0)
  return { groups: snapshotGroups, total, distribution }
}

const applyTarget = (
  joint: JointDist,
  shapes: GroupShape[],
  target: RerollSpec['target'],
): JointDist => {
  if (target === 'MISSES') return applyMissesReroll(joint, shapes)
  if (target === 'HITS') return applyHitsReroll(joint, shapes)
  return applyAllReroll(joint, shapes)
}

const addToLabeled = (
  labeled: LabeledDist,
  key: string,
  label: number,
  mass: number,
) => {
  if (mass === 0) return
  let inner = labeled.cells.get(key)
  if (!inner) {
    inner = new Map()
    labeled.cells.set(key, inner)
  }
  inner.set(label, (inner.get(label) ?? 0) + mass)
}

export function foldRerollsForSide(
  groups: GroupRoll[],
  queue: QueuedSpec[],
): SideBranch[] {
  const shapes = groups.map(groupShape)
  const initial = buildInitialJoint(shapes)

  let labeled: LabeledDist = {
    groupCount: initial.groupCount,
    cells: new Map(),
  }
  for (const [k, v] of initial.cells) {
    labeled.cells.set(k, new Map([[0, v]]))
  }

  for (let i = 0; i < queue.length; i++) {
    const { spec } = queue[i]
    const bit = 1 << i
    const rerollIf = spec.rerollIf ?? (() => true)
    const consumeUseIf = spec.consumeUseIf ?? rerollIf

    const currentJoint = marginalJoint(labeled)
    const totalDist = marginalTotalDist(currentJoint)

    const next: LabeledDist = {
      groupCount: labeled.groupCount,
      cells: new Map(),
    }

    for (const [key, byLabel] of labeled.cells) {
      const cellHits = decodeKey(key)
      const side = buildSideSnapshot(groups, cellHits, totalDist)
      const fires = rerollIf(side)
      const consumes = consumeUseIf(side)

      if (!fires) {
        for (const [label, mass] of byLabel) {
          const newLabel = consumes ? label | bit : label
          addToLabeled(next, key, newLabel, mass)
        }
        continue
      }

      const singleton: JointDist = {
        groupCount: labeled.groupCount,
        cells: new Map([[key, 1]]),
      }
      const sub = applyTarget(singleton, shapes, spec.target)

      for (const [label, mass] of byLabel) {
        const newLabel = consumes ? label | bit : label
        for (const [subKey, subProb] of sub.cells) {
          addToLabeled(next, subKey, newLabel, mass * subProb)
        }
      }
    }

    labeled = next
  }

  const byLabel = new Map<number, Map<string, number>>()
  for (const [key, inner] of labeled.cells) {
    for (const [label, mass] of inner) {
      let cells = byLabel.get(label)
      if (!cells) {
        cells = new Map()
        byLabel.set(label, cells)
      }
      cells.set(key, (cells.get(key) ?? 0) + mass)
    }
  }

  const branches: SideBranch[] = []
  for (const [label, cells] of byLabel) {
    let probability = 0
    for (const v of cells.values()) probability += v
    if (probability === 0) continue

    const normalized = new Map<string, number>()
    for (const [k, v] of cells) normalized.set(k, v / probability)

    const usesDelta: Record<string, -1> = {}
    for (let i = 0; i < queue.length; i++) {
      if (label & (1 << i)) usesDelta[queue[i].abilityKey] = -1
    }

    branches.push({
      dist: { groupCount: labeled.groupCount, cells: normalized },
      probability,
      usesDelta,
    })
  }

  return branches
}

const identityBranch = (groups: GroupRoll[]): SideBranch => {
  const shapes = groups.map(groupShape)
  const dist = buildInitialJoint(shapes)
  return { dist, probability: 1, usesDelta: {} }
}

export function foldRerolls(
  attackerGroups: GroupRoll[],
  defenderGroups: GroupRoll[],
  queue: QueuedSpecForSide[],
): JointBranch[] {
  const attQueue: QueuedSpec[] = []
  const defQueue: QueuedSpec[] = []
  for (const q of queue) {
    const item: QueuedSpec = { abilityKey: q.abilityKey, spec: q.spec }
    if (q.side === 'attacker') attQueue.push(item)
    else defQueue.push(item)
  }

  const attBranches =
    attQueue.length === 0
      ? [identityBranch(attackerGroups)]
      : foldRerollsForSide(attackerGroups, attQueue)
  const defBranches =
    defQueue.length === 0
      ? [identityBranch(defenderGroups)]
      : foldRerollsForSide(defenderGroups, defQueue)

  const out: JointBranch[] = []
  for (const a of attBranches) {
    for (const d of defBranches) {
      const usesDelta: Record<string, -1> = { ...a.usesDelta, ...d.usesDelta }
      out.push({
        attackerDist: a.dist,
        defenderDist: d.dist,
        probability: a.probability * d.probability,
        usesDelta,
      })
    }
  }
  return out
}
