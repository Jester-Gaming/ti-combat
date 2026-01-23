import { ArrowUpIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import styles from './unit-controls.module.css'

interface UnitControlsProps {
  count: number
  upgraded: boolean
  hasUpgrade: boolean
  onCountChange: (count: number) => void
  onUpgradeToggle: () => void
}

export function UnitControls({
  count,
  upgraded,
  hasUpgrade,
  onCountChange,
  onUpgradeToggle,
}: UnitControlsProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber
    if (isNaN(value)) {
      onCountChange(0)
      return
    }
    onCountChange(Math.max(0, Math.trunc(value)))
  }

  return (
    <div className={styles.controls}>
      {hasUpgrade ? (
        <button
          className={clsx(
            styles.upgradeButton,
            upgraded && styles.upgradeActive,
          )}
          onClick={onUpgradeToggle}
          title={upgraded ? 'Upgraded' : 'Click to upgrade'}
        >
          <ArrowUpIcon
            className={
              upgraded ? styles.upgradeIcon : styles.upgradeIconInactive
            }
          />
        </button>
      ) : (
        <div className={styles.upgradePlaceholder} />
      )}
      <button
        className={clsx(styles.button, count === 0 && styles.buttonDisabled)}
        onClick={() => onCountChange(Math.max(0, count - 1))}
        disabled={count === 0}
        tabIndex={-1}
      >
        <MinusIcon className={styles.buttonIcon} />
      </button>

      <input
        type="number"
        min={0}
        step={1}
        value={count}
        onChange={handleInputChange}
        className={styles.countInput}
      />
      <button
        className={styles.button}
        onClick={() => onCountChange(count + 1)}
        tabIndex={-1}
      >
        <PlusIcon className={styles.buttonIcon} />
      </button>
    </div>
  )
}
