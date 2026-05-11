export interface GroupShape {
  N: number
  p: number
}

export interface JointDist {
  groupCount: number
  cells: Map<string, number>
}

export function binomialPmf(n: number, p: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i
  return r * Math.pow(p, k) * Math.pow(1 - p, n - k)
}

export function encodeKey(h: number[]): string {
  return h.length === 1 ? `${h[0]}` : h.join(',')
}

export function decodeKey(k: string): number[] {
  return k === '' ? [] : k.split(',').map(Number)
}

export function buildInitialJoint(shapes: GroupShape[]): JointDist {
  const cells = new Map<string, number>()
  const G = shapes.length
  const recurse = (g: number, acc: number[], prob: number) => {
    if (g === G) {
      cells.set(encodeKey(acc), prob)
      return
    }
    const { N, p } = shapes[g]
    for (let h = 0; h <= N; h++) {
      acc.push(h)
      recurse(g + 1, acc, prob * binomialPmf(N, p, h))
      acc.pop()
    }
  }
  recurse(0, [], 1)
  return { groupCount: G, cells }
}

export function marginalTotal(joint: JointDist): Map<number, number> {
  const out = new Map<number, number>()
  for (const [k, v] of joint.cells) {
    const total = decodeKey(k).reduce((a, b) => a + b, 0)
    out.set(total, (out.get(total) ?? 0) + v)
  }
  return out
}

export function applyMissesReroll(
  joint: JointDist,
  shapes: GroupShape[],
): JointDist {
  return transformPerOutcomeAdditive(joint, shapes, (shape, h) => {
    const rerolling = shape.N - h
    const out: { add: number; prob: number }[] = []
    for (let x = 0; x <= rerolling; x++) {
      out.push({ add: x, prob: binomialPmf(rerolling, shape.p, x) })
    }
    return out
  })
}

export function applyHitsReroll(
  joint: JointDist,
  shapes: GroupShape[],
): JointDist {
  return transformPerOutcomeAbsolute(joint, shapes, (shape, h) => {
    const out: { newHits: number; prob: number }[] = []
    for (let x = 0; x <= h; x++) {
      out.push({ newHits: x, prob: binomialPmf(h, shape.p, x) })
    }
    return out
  })
}

export function applyAllReroll(
  _joint: JointDist,
  shapes: GroupShape[],
): JointDist {
  return buildInitialJoint(shapes)
}

function transformPerOutcomeAdditive(
  joint: JointDist,
  shapes: GroupShape[],
  fn: (shape: GroupShape, h: number) => { add: number; prob: number }[],
): JointDist {
  const out = new Map<string, number>()
  for (const [key, prob] of joint.cells) {
    const h = decodeKey(key)
    const perGroup = h.map((hg, g) => fn(shapes[g], hg))
    const G = h.length
    const recurse = (g: number, acc: number[], p: number) => {
      if (g === G) {
        const k = encodeKey(acc)
        out.set(k, (out.get(k) ?? 0) + p)
        return
      }
      for (const opt of perGroup[g]) {
        acc.push(h[g] + opt.add)
        recurse(g + 1, acc, p * opt.prob)
        acc.pop()
      }
    }
    recurse(0, [], prob)
  }
  return { groupCount: joint.groupCount, cells: out }
}

function transformPerOutcomeAbsolute(
  joint: JointDist,
  shapes: GroupShape[],
  fn: (shape: GroupShape, h: number) => { newHits: number; prob: number }[],
): JointDist {
  const out = new Map<string, number>()
  for (const [key, prob] of joint.cells) {
    const h = decodeKey(key)
    const perGroup = h.map((hg, g) => fn(shapes[g], hg))
    const G = h.length
    const recurse = (g: number, acc: number[], p: number) => {
      if (g === G) {
        const k = encodeKey(acc)
        out.set(k, (out.get(k) ?? 0) + p)
        return
      }
      for (const opt of perGroup[g]) {
        acc.push(opt.newHits)
        recurse(g + 1, acc, p * opt.prob)
        acc.pop()
      }
    }
    recurse(0, [], prob)
  }
  return { groupCount: joint.groupCount, cells: out }
}
