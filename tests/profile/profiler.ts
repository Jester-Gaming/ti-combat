import { writeFile } from 'node:fs/promises'
import { Session } from 'node:inspector/promises'

import { CombatEngine, CombatState } from '@/combat'

const TOP_N = 25

interface CoverageRange {
  startOffset: number
  endOffset: number
  count: number
}

interface FunctionCoverage {
  functionName: string
  ranges: CoverageRange[]
  isBlockCoverage: boolean
}

interface ScriptCoverage {
  scriptId: string
  url: string
  functions: FunctionCoverage[]
}

function buildCoverageMap(scripts: ScriptCoverage[]) {
  const callCounts = new Map<string, number>()
  for (const script of scripts) {
    if (!script.url.includes('/src/')) continue
    const file = script.url.replace(/.*\/src\//, 'src/')
    for (const fn of script.functions) {
      if (!fn.functionName) continue
      const count = fn.ranges[0]?.count ?? 0
      if (count === 0) continue
      const key = `${fn.functionName} @ ${file}`
      callCounts.set(key, (callCounts.get(key) || 0) + count)
    }
  }
  return callCounts
}

interface CPUProfileNode {
  id: number
  callFrame: {
    functionName: string
    url: string
    lineNumber: number
  }
}

interface CPUProfile {
  nodes: CPUProfileNode[]
  samples: number[]
}

function analyze(profile: CPUProfile, coverageCalls: Map<string, number>) {
  const selfTime = new Map<number, number>()

  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i]
    selfTime.set(id, (selfTime.get(id) || 0) + 1)
  }

  const funcSelf = new Map<string, number>()
  const funcCoverageKey = new Map<string, string>()
  for (const n of profile.nodes) {
    const fn = n.callFrame
    const name = fn.functionName || '(anon)'
    const file = fn.url.replace(/.*\/src\//, 'src/')
    const key = `${name} @ ${file}:${fn.lineNumber + 1}`
    funcSelf.set(key, (funcSelf.get(key) || 0) + (selfTime.get(n.id) || 0))
    funcCoverageKey.set(key, `${name} @ ${file}`)
  }

  const total = profile.samples.length
  const sorted = [...funcSelf.entries()].sort((a, b) => b[1] - a[1])

  console.info(`Total samples: ${total}\n`)
  console.info(`Top ${TOP_N} by SELF time:`)
  for (let i = 0; i < Math.min(TOP_N, sorted.length); i++) {
    const [key, self] = sorted[i]
    const selfPct = ((self / total) * 100).toFixed(1)
    const covKey = funcCoverageKey.get(key)!
    const calls = coverageCalls.get(covKey) ?? '?'
    console.info(
      `  ${selfPct.padStart(5)}%  ${String(self).padStart(5)}  ${String(calls).padStart(8)} calls  ${key}`,
    )
  }
}

export async function runProfile(state: CombatState, profilePath: string) {
  const session = new Session()
  session.connect()

  try {
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', {
      interval: 10,
    })
    await session.post('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    })
    await session.post('Profiler.start')

    const t0 = performance.now()
    const engine = new CombatEngine()
    const results = engine.simulate(state)
    const elapsed = performance.now() - t0

    const coverageResult = await session.post('Profiler.takePreciseCoverage')
    await session.post('Profiler.stopPreciseCoverage')
    const stopResult = await session.post('Profiler.stop')

    console.info(
      `Simulation: ${elapsed.toFixed(1)}ms, ${results.length} outcomes\n`,
    )

    await writeFile(profilePath, JSON.stringify(stopResult.profile))
    console.info(`Profile saved to ${profilePath}\n`)

    const coverageCalls = buildCoverageMap(
      coverageResult.result as unknown as ScriptCoverage[],
    )
    analyze(stopResult.profile as unknown as CPUProfile, coverageCalls)
  } finally {
    session.disconnect()
  }
}
