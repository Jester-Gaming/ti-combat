import { clsx } from 'clsx'

import type { CombatOutcome, SurvivorSide } from '@/combat'
import { UNIT_SHORT_NAMES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

import styles from './detailed-outcomes.module.css'
import { sortSurvivors } from './sort-survivors'

interface UnitPriority {
  attacker: string[]
  defender: string[]
}

interface DetailedOutcomesProps {
  outcomes: CombatOutcome[]
  unitPriority: UnitPriority
}

export function DetailedOutcomes({
  outcomes,
  unitPriority,
}: DetailedOutcomesProps) {
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
                outcome.winner === 'attacker' && styles.outcomeRow_attacker,
                outcome.winner === 'defender' && styles.outcomeRow_defender,
                outcome.winner === 'draw' && styles.outcomeRow_draw,
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
              <td
                className={clsx(styles.outcomeSide, styles.outcomeSide_right)}
              >
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
  const entries = sortSurvivors(side, priority)
  if (entries.length === 0) {
    return <span className={styles.noSurvivors}>&mdash;</span>
  }

  const parts: string[] = []
  for (const entry of entries) {
    const name = UNIT_SHORT_NAMES[entry.base as UnitBaseType] ?? entry.base
    const label = entry.subtypes ? `${name}:${entry.subtypes.join(',')}` : name
    if (entry.healthy > 0) {
      parts.push(entry.healthy > 1 ? `${entry.healthy}${label}` : label)
    }
    if (entry.damaged > 0) {
      const dmgLabel = `${label}-`
      parts.push(entry.damaged > 1 ? `${entry.damaged}${dmgLabel}` : dmgLabel)
    }
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className={styles.unitEntry}>
          {i > 0 && <span className={styles.unitSeparator}>,&nbsp;</span>}
          {part}
        </span>
      ))}
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

    // More damaged defender units means defender is worse off — better for attacker
    return countDamaged(b.defender) - countDamaged(a.defender)
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
