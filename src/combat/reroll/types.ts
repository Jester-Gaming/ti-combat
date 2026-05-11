import type { UnitId, UnitType } from '@/types'

export type RerollStrategy =
  | { kind: 'NEVER' }
  | { kind: 'ALWAYS' }
  | { kind: 'IF_HITS_LE'; threshold: number }
  | { kind: 'IF_HITS_GE'; threshold: number }
  | { kind: 'IF_BAD_OUTCOME'; pct: number }

export interface GroupRoll {
  source: UnitType
  variantKey: string
  units: UnitId[]
  dicePerUnit: number
  hitValue: number
  hits: number[]
}

export type HitsDist = readonly { hits: number; probability: number }[]

export interface RerollSide {
  groups: GroupRoll[]
  total: number
  distribution: HitsDist
}

export type RerollTarget = 'MISSES' | 'HITS' | 'ALL'

export interface RerollSpec {
  target: RerollTarget
  rerollIf?: (side: RerollSide) => boolean
  consumeUseIf?: (side: RerollSide) => boolean
}
