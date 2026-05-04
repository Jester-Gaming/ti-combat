import { ArrowUpIcon, MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import styles from './unit-controls.module.css'

interface UnitControlsProps {
  count: number
  upgraded: boolean
  hasUpgrade: boolean
  limit: number
  onCountChange: (count: number) => void
  onUpgradeToggle: () => void
}

export function UnitControls({
  count,
  upgraded,
  hasUpgrade,
  limit,
  onCountChange,
  onUpgradeToggle,
}: UnitControlsProps) {
  const atLimit = count >= limit

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber
    if (isNaN(value)) {
      onCountChange(0)
      return
    }
    onCountChange(Math.min(limit, Math.max(0, Math.trunc(value))))
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
              upgraded ? styles.upgradeIcon : styles.upgradeIcon_inactive
            }
          />
        </button>
      ) : (
        <div className={styles.upgradePlaceholder} />
      )}
      <button
        className={clsx(styles.button, count === 0 && styles.button_disabled)}
        onClick={() => onCountChange(Math.max(0, count - 1))}
        disabled={count === 0}
        tabIndex={-1}
      >
        <MinusIcon className={styles.buttonIcon} />
      </button>

      <input
        type="number"
        min={0}
        max={limit}
        step={1}
        value={count}
        onChange={handleInputChange}
        className={styles.countInput}
      />
      <button
        className={clsx(styles.button, atLimit && styles.button_disabled)}
        onClick={() => onCountChange(count + 1)}
        disabled={atLimit}
        tabIndex={-1}
      >
        <PlusIcon className={styles.buttonIcon} />
      </button>
    </div>
  )
}
