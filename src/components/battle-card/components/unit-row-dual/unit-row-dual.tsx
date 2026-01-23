import { clsx } from 'clsx'

import { UnitControls, unitControlStyles } from '../unit-controls'
import styles from './unit-row-dual.module.css'

interface UnitRowDualProps {
  name: string
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
        className={clsx(unitControlStyles.side, unitControlStyles.sideAttacker)}
      >
        <UnitControls
          count={attacker.count}
          upgraded={attacker.upgraded}
          hasUpgrade={attackerHasUpgrade}
          onCountChange={onAttackerCountChange}
          onUpgradeToggle={onAttackerUpgradeToggle}
        />
      </div>
      <span className={styles.unitName}>{name}</span>
      <div
        className={clsx(unitControlStyles.side, unitControlStyles.sideDefender)}
      >
        <UnitControls
          count={defender.count}
          upgraded={defender.upgraded}
          hasUpgrade={defenderHasUpgrade}
          onCountChange={onDefenderCountChange}
          onUpgradeToggle={onDefenderUpgradeToggle}
        />
      </div>
    </div>
  )
}
