import { CheckIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { forwardRef, type MouseEventHandler } from 'react'

import styles from './checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  onClick?: MouseEventHandler<HTMLLabelElement>
  onPointerDown?: MouseEventHandler<HTMLLabelElement>
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { checked, onChange, disabled, className, onClick, onPointerDown },
    ref,
  ): React.ReactElement => {
    return (
      <label
        className={clsx(styles.wrapper, className)}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className={styles.hiddenInput}
          ref={ref}
        />
        <span className={clsx(styles.checkbox)}>
          <CheckIcon className={styles.checkIcon} />
        </span>
      </label>
    )
  },
)
