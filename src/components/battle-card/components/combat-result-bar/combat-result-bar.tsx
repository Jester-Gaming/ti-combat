import { clsx } from 'clsx'
import { useState } from 'react'

import type { CombatOutcome, SurvivorSide } from '@/combat/types'
import { UNIT_SHORT_NAMES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

import styles from './combat-result-bar.module.css'

export interface CombatResult {
  attackerWin: number
  draw: number
  defenderWin: number
}

export interface UnitPriority {
  attacker: string[]
  defender: string[]
}

interface CombatResultBarProps {
  result: CombatResult | null
  outcomes: CombatOutcome[] | null
  unitPriority: UnitPriority
  isComputing?: boolean
}

export function CombatResultBar({
  result,
  outcomes,
  unitPriority,
  isComputing,
}: CombatResultBarProps) {
  const [showDetailed, setShowDetailed] = useState(false)
  const segments = result && buildSegments(result)

  return (
    <div className={styles.wrapper}>
      {segments ? (
        <>
          <div
            className={clsx(styles.resultBar, isComputing && styles.loading)}
          >
            {segments.map(({ key, percent, label, segmentClass }) => (
              <div
                key={key}
                className={clsx(styles.segment, segmentClass)}
                style={{ width: `${percent}%` }}
                title={`${percent}%`}
              >
                {percent > 5 && (
                  <span className={styles.segmentContent}>
                    <span className={styles.percentage}>{percent}%</span>
                    <span className={styles.label}>{label}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.detailedButton}
            onClick={() => setShowDetailed(v => !v)}
          >
            {showDetailed ? 'Hide' : 'Detailed'}
          </button>
        </>
      ) : isComputing ? (
        <div className={clsx(styles.emptyState, styles.skeleton)}>
          <span className={styles.loader} />
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateText}>
            Add units to calculate combat odds
          </span>
        </div>
      )}

      {showDetailed && outcomes && outcomes.length > 0 && (
        <DetailedOutcomes outcomes={outcomes} unitPriority={unitPriority} />
      )}
    </div>
  )
}

function DetailedOutcomes({
  outcomes,
  unitPriority,
}: {
  outcomes: CombatOutcome[]
  unitPriority: UnitPriority
}) {
  const sorted = sortOutcomes(outcomes)

  return (
    <div className={styles.detailedPanel}>
      <table className={styles.detailedTable}>
        <thead>
          <tr className={styles.detailedHeader}>
            <th className={styles.detailedHeaderSide}>Attacker</th>
            <th className={styles.detailedHeaderProb}>%</th>
            <th className={styles.detailedHeaderSide}>Defender</th>
          </tr>
        </thead>
        <tbody className={styles.detailedList}>
          {sorted.map((outcome, i) => (
            <tr
              key={i}
              className={clsx(
                styles.outcomeRow,
                outcome.winner === 'attacker' && styles.outcomeRowAttacker,
                outcome.winner === 'defender' && styles.outcomeRowDefender,
                outcome.winner === 'draw' && styles.outcomeRowDraw,
              )}
            >
              <td className={styles.outcomeSide}>
                <SurvivorList
                  side={outcome.attacker}
                  priority={unitPriority.attacker}
                />
              </td>
              <td
                className={styles.outcomeProb}
                title={`${toFullDecimal(outcome.probability * 100)}%`}
              >
                {formatProbability(outcome.probability)}
              </td>
              <td className={clsx(styles.outcomeSide, styles.outcomeSideRight)}>
                <SurvivorList
                  side={outcome.defender}
                  priority={unitPriority.defender}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SurvivorList({
  side,
  priority,
}: {
  side: SurvivorSide
  priority: string[]
}) {
  const entries = Object.entries(side)
    .filter(([, units]) => units && units.length > 0)
    .sort(([a], [b]) => {
      const aIdx = priority.findIndex(v => v === a || v.startsWith(`${a}:`))
      const bIdx = priority.findIndex(v => v === b || v.startsWith(`${b}:`))
      // Units not in priority go to the end
      const aPos = aIdx === -1 ? Infinity : aIdx
      const bPos = bIdx === -1 ? Infinity : bIdx
      return bPos - aPos
    })
  if (entries.length === 0) {
    return <span className={styles.noSurvivors}>&mdash;</span>
  }

  return (
    <>
      {entries.map(([unitType, units], i) => {
        if (!units) return null
        const name = UNIT_SHORT_NAMES[unitType as UnitBaseType] ?? unitType
        const damaged = units.filter(u => u.isDamaged).length
        const healthy = units.length - damaged
        const subtypes = units[0]?.subtypes

        const parts: string[] = []

        if (healthy > 0) {
          const label = subtypes?.length
            ? `${name}:${subtypes.join(',')}`
            : name
          parts.push(healthy > 1 ? `${healthy}${label}` : label)
        }
        if (damaged > 0) {
          const label = subtypes?.length
            ? `${name}:${subtypes.join(',')}`
            : name
          const dmgLabel = `${label}-`
          parts.push(damaged > 1 ? `${damaged}${dmgLabel}` : dmgLabel)
        }

        return (
          <span key={unitType} className={styles.unitEntry}>
            {i > 0 && <span className={styles.unitSeparator}>,&nbsp;</span>}
            {parts.map((part, j) => (
              <span key={j}>
                {j > 0 && <span className={styles.unitSeparator}>,&nbsp;</span>}
                {part}
              </span>
            ))}
          </span>
        )
      })}
    </>
  )
}

/** Sort outcomes from best to worst for attacker */
function sortOutcomes(outcomes: CombatOutcome[]): CombatOutcome[] {
  return [...outcomes].sort((a, b) => {
    // Winner priority: attacker wins (best) → draw → defender wins (worst)
    const winOrder = { attacker: 0, draw: 1, defender: 2 }
    const winDiff = winOrder[a.winner] - winOrder[b.winner]
    if (winDiff !== 0) return winDiff

    // Within same winner category, sort by net survivor count (descending)
    const aNet = countUnits(a.attacker) - countUnits(a.defender)
    const bNet = countUnits(b.attacker) - countUnits(b.defender)
    if (aNet !== bNet) return bNet - aNet

    // Same net count — fewer damaged attacker units is better
    const aDmg = countDamaged(a.attacker) - countDamaged(b.attacker)
    if (aDmg !== 0) return aDmg

    // Fewer damaged defender units means defender is worse off — better for attacker
    return countDamaged(a.defender) - countDamaged(b.defender)
  })
}

function countUnits(side: SurvivorSide): number {
  return Object.values(side).reduce(
    (sum, units) => sum + (units?.length ?? 0),
    0,
  )
}

function countDamaged(side: SurvivorSide): number {
  return Object.values(side).reduce(
    (sum, units) => sum + (units?.filter(u => u.isDamaged).length ?? 0),
    0,
  )
}

function formatProbability(p: number): string {
  const pct = p * 100
  if (pct < 0.01) return '<0.01'
  if (pct >= 99.995) return '~100'
  return pct.toFixed(2)
}

/** Convert a number to full decimal string without scientific notation */
function toFullDecimal(n: number): string {
  if (n === 0) return '0'
  const s = n.toPrecision(8)
  if (!s.includes('e')) return s
  const [coeff, exp] = s.split('e')
  const e = Number(exp)
  const [int, frac = ''] = coeff.replace('-', '').split('.')
  const digits = int + frac
  const sign = n < 0 ? '-' : ''
  if (e >= 0) {
    const zeroes = Math.max(0, e + 1 - digits.length)
    return sign + digits + '0'.repeat(zeroes)
  }
  const pad = Math.max(0, -e - int.length)
  return sign + '0.' + '0'.repeat(pad) + digits
}

function roundToSum100(values: number[]): number[] {
  const floored = values.map(Math.floor)
  const remainders = values.map((v, i) => ({
    index: i,
    remainder: v - floored[i],
  }))
  let deficit = 100 - floored.reduce((a, b) => a + b, 0)

  remainders.sort((a, b) => b.remainder - a.remainder)
  for (const { index } of remainders) {
    if (deficit <= 0) break
    floored[index]++
    deficit--
  }

  return floored
}

function buildSegments(result: CombatResult) {
  const [attackerPct, drawPct, defenderPct] = roundToSum100([
    result.attackerWin * 100,
    result.draw * 100,
    result.defenderWin * 100,
  ])

  return [
    {
      key: 'attacker',
      percent: attackerPct,
      label: 'Attacker',
      segmentClass: styles.segmentAttacker,
    },
    {
      key: 'draw',
      percent: drawPct,
      label: 'Draw',
      segmentClass: styles.segmentDraw,
    },
    {
      key: 'defender',
      percent: defenderPct,
      label: 'Defender',
      segmentClass: styles.segmentDefender,
    },
  ]
}
