import { CheckIcon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'

import styles from './checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Checkbox({
  checked,
  onChange,
  className,
}: CheckboxProps): React.ReactElement {
  return (
    <label className={clsx(styles.wrapper, className)}>
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
