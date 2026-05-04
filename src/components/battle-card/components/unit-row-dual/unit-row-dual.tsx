import { clsx } from 'clsx'

import { UnitControls, unitControlStyles } from '../unit-controls'
import styles from './unit-row-dual.module.css'

interface UnitRowDualProps {
  name: string
  shortName: string
  limit: number
  attackerHasUpgrade: boolean
  defenderHasUpgrade: boolean
  attacker: { count: number; upgraded: boolean }
  defender: { count: number; upgraded: boolean }
  onAttackerCountChange: (count: number) => void
  onAttackerUpgradeToggle: () => void
  onDefenderCountChange: (count: number) => void
  onDefenderUpgradeToggle: () => void
}

export function UnitRowDual({
  name,
  shortName,
  limit,
  attackerHasUpgrade,
  defenderHasUpgrade,
  attacker,
  defender,
  onAttackerCountChange,
  onAttackerUpgradeToggle,
  onDefenderCountChange,
  onDefenderUpgradeToggle,
}: UnitRowDualProps) {
  return (
    <div className={styles.row}>
      <div
        className={clsx(
          unitControlStyles.side,
          unitControlStyles.side_attacker,
        )}
      >
        <UnitControls
          count={attacker.count}
          upgraded={attacker.upgraded}
          hasUpgrade={attackerHasUpgrade}
          limit={limit}
          onCountChange={onAttackerCountChange}
          onUpgradeToggle={onAttackerUpgradeToggle}
        />
      </div>
      <span className={styles.unitName}>
        <span className={styles.fullName}>{name}</span>
        <span className={styles.shortName}>{shortName}</span>
      </span>
      <div
        className={clsx(
          unitControlStyles.side,
          unitControlStyles.side_defender,
        )}
      >
        <UnitControls
          count={defender.count}
          upgraded={defender.upgraded}
          hasUpgrade={defenderHasUpgrade}
          limit={limit}
          onCountChange={onDefenderCountChange}
          onUpgradeToggle={onDefenderUpgradeToggle}
        />
      </div>
    </div>
  )
}
