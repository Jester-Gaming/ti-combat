import { clsx } from 'clsx'

import styles from './combat-result-bar.module.css'

export interface CombatResult {
  attackerWin: number
  draw: number
  defenderWin: number
}

interface CombatResultBarProps {
  result: CombatResult | null
}

export function CombatResultBar({ result }: CombatResultBarProps) {
  const segments = result && buildSegments(result)

  return (
    <div className={styles.wrapper}>
      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerLabel}>Outcome</span>
        <div className={styles.dividerLine} />
      </div>

      {segments ? (
        <div className={clsx(styles.resultBar)}>
          {segments.map(
            ({ key, percent: percent, label, segmentClass }) =>
              percent > 0 && (
                <div
                  key={key}
                  className={clsx(styles.segment, segmentClass)}
                  style={{ width: `${percent}%` }}
                  title={`${percent}%`}
                >
                  {percent > 5 && (
                    <span className={styles.segmentContent}>
                      <span className={clsx(styles.percentage)}>
                        {percent}%
                      </span>
                      <span className={styles.label}>{label}</span>
                    </span>
                  )}
                </div>
              ),
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateText}>
            Add units to calculate combat odds
          </span>
        </div>
      )}
    </div>
  )
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
