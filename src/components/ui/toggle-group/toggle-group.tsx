import { clsx } from 'clsx'

import styles from './toggle-group.module.css'

interface ToggleGroupOption<T extends string> {
  value: T
  label: string
}

interface ToggleGroupProps<T extends string> {
  options: ToggleGroupOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: ToggleGroupProps<T>) {
  return (
    <div className={styles.group}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={clsx(
            styles.button,
            option.value === value && styles.active,
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
