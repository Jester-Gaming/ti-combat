import { CheckIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import type { MouseEventHandler } from 'react'

import styles from './checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
  onClick?: MouseEventHandler<HTMLLabelElement>
}

export function Checkbox({
  checked,
  onChange,
  className,
  onClick,
}: CheckboxProps): React.ReactElement {
  return (
    <label className={clsx(styles.wrapper, className)} onClick={onClick}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className={styles.hiddenInput}
      />
      <span className={clsx(styles.checkbox, checked && styles.checked)}>
        {checked && <CheckIcon className={styles.checkIcon} />}
      </span>
    </label>
  )
}
