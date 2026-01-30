import { CheckIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { MouseEventHandler } from 'react'

import styles from './checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  onClick?: MouseEventHandler<HTMLLabelElement>
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  onClick,
}: CheckboxProps): React.ReactElement {
  return (
    <label
      className={clsx(styles.wrapper, disabled && styles.disabled, className)}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className={styles.hiddenInput}
      />
      <span className={clsx(styles.checkbox, checked && styles.checked)}>
        {checked && <CheckIcon className={styles.checkIcon} />}
      </span>
    </label>
  )
}
